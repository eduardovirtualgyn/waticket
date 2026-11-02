import Contact from "../../models/Contact";
import { getIO } from "../../libs/socket";

interface RawContactInput {
  name?: string;
  number: string;
  email?: string;
}

interface Request {
  content?: string;
  contactsJson?: RawContactInput[] | string;
}

interface ResponseResult {
  imported: number;
  updated: number;
  duplicates: number;
  total: number;
}

const splitCsvLine = (line: string, delimiter = ","): string[] => {
  const result: string[] = [];
  let current = "";
  let insideQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      insideQuotes = !insideQuotes;
    } else if (char === delimiter && !insideQuotes) {
      result.push(current.trim().replace(/^["']|["']$/g, ""));
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^["']|["']$/g, ""));
  return result;
};

export const parseContactsFromText = (content: string): RawContactInput[] => {
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  const firstLine = lines[0].toLowerCase();
  const hasHeader =
    firstLine.includes("nome") ||
    firstLine.includes("name") ||
    firstLine.includes("telefone") ||
    firstLine.includes("phone") ||
    firstLine.includes("celular") ||
    firstLine.includes("whatsapp") ||
    firstLine.includes("contato") ||
    firstLine.includes("number");

  const delimiter = firstLine.includes(";")
    ? ";"
    : firstLine.includes("\t")
    ? "\t"
    : ",";

  let firstNameIdx = -1;
  let middleNameIdx = -1;
  let lastNameIdx = -1;
  let nameIdx = -1;
  let numberIdx = -1;
  let emailIdx = -1;
  let startIndex = 0;

  if (hasHeader) {
    startIndex = 1;
    const headerCols = splitCsvLine(lines[0], delimiter).map(c =>
      c.toLowerCase()
    );

    headerCols.forEach((col, idx) => {
      // Detect Phone column (supports Google Contacts 'Phone 1 - Value', 'Phone', 'Telefone', etc)
      if (col.includes("phone") && col.includes("value")) {
        numberIdx = idx;
      } else if (
        numberIdx === -1 &&
        (col === "phone" ||
          col === "telefone" ||
          col === "celular" ||
          col === "whatsapp" ||
          col === "mobile")
      ) {
        numberIdx = idx;
      } else if (
        numberIdx === -1 &&
        (col.includes("tel") ||
          col.includes("cel") ||
          col.includes("phone") ||
          col.includes("whats")) &&
        !col.includes("label") &&
        !col.includes("type")
      ) {
        numberIdx = idx;
      }

      // Detect Name columns (supports Google Contacts 'First Name', 'Middle Name', 'Last Name')
      if (
        col === "first name" ||
        (col.includes("first name") && !col.includes("phonetic"))
      ) {
        firstNameIdx = idx;
      } else if (
        col === "middle name" ||
        (col.includes("middle name") && !col.includes("phonetic"))
      ) {
        middleNameIdx = idx;
      } else if (
        col === "last name" ||
        (col.includes("last name") && !col.includes("phonetic"))
      ) {
        lastNameIdx = idx;
      } else if (
        col === "name" ||
        col === "nome" ||
        col === "contato" ||
        col === "contact"
      ) {
        nameIdx = idx;
      } else if (
        nameIdx === -1 &&
        (col.includes("nome") || col.includes("name")) &&
        !col.includes("org") &&
        !col.includes("phonetic") &&
        !col.includes("prefix") &&
        !col.includes("suffix")
      ) {
        nameIdx = idx;
      }

      // Detect Email
      if (col.includes("mail") && !col.includes("label")) {
        emailIdx = idx;
      }
    });
  }

  const result: RawContactInput[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine) continue;

    const parts = splitCsvLine(rawLine, delimiter);
    if (!parts.length) continue;

    let name = "";
    let number = "";
    let email = emailIdx !== -1 ? parts[emailIdx] || "" : "";

    if (firstNameIdx !== -1) {
      const first = parts[firstNameIdx] || "";
      const middle = middleNameIdx !== -1 ? parts[middleNameIdx] || "" : "";
      const last = lastNameIdx !== -1 ? parts[lastNameIdx] || "" : "";
      name = [first, middle, last].filter(Boolean).join(" ").trim();
    } else if (nameIdx !== -1) {
      name = parts[nameIdx] || "";
    }

    if (numberIdx !== -1) {
      number = parts[numberIdx] || "";
    }

    // Fallback: search row for valid phone number if not found at index
    if (!number || number.replace(/\D/g, "").length < 8) {
      for (const p of parts) {
        const clean = p.replace(/\D/g, "");
        if (clean.length >= 8 && clean.length <= 15) {
          number = p;
          break;
        } else if (p.includes("@") && !email) {
          email = p;
        }
      }
    }

    let cleanNumber = number.replace(/\D/g, "");
    if (cleanNumber.length < 8) continue;

    if (cleanNumber.length === 10 || cleanNumber.length === 11) {
      cleanNumber = `55${cleanNumber}`;
    }

    if (!name) {
      name = cleanNumber;
    }

    result.push({
      name,
      number: cleanNumber,
      email
    });
  }

  return result;
};

const ImportCsvContactsService = async ({
  content,
  contactsJson
}: Request): Promise<ResponseResult> => {
  let contactsToProcess: RawContactInput[] = [];

  if (contactsJson) {
    if (typeof contactsJson === "string") {
      try {
        contactsToProcess = JSON.parse(contactsJson);
      } catch (e) {
        contactsToProcess = [];
      }
    } else if (Array.isArray(contactsJson)) {
      contactsToProcess = contactsJson;
    }
  }

  if (content && (!contactsToProcess || contactsToProcess.length === 0)) {
    contactsToProcess = parseContactsFromText(content);
  }

  let imported = 0;
  let updated = 0;
  let duplicates = 0;

  const io = getIO();

  for (const item of contactsToProcess) {
    let cleanNumber = String(item.number || "").replace(/\D/g, "");
    if (!cleanNumber || cleanNumber.length < 8) continue;

    if (cleanNumber.length === 10 || cleanNumber.length === 11) {
      cleanNumber = `55${cleanNumber}`;
    }

    const name =
      item.name && item.name.trim() !== "" ? item.name.trim() : cleanNumber;
    const email = item.email ? item.email.trim() : "";

    const existingContact = await Contact.findOne({
      where: { number: cleanNumber }
    });

    if (existingContact) {
      const needsUpdate =
        (existingContact.name === cleanNumber && name !== cleanNumber) ||
        (!existingContact.email && email);

      if (needsUpdate) {
        await existingContact.update({
          name: name !== cleanNumber ? name : existingContact.name,
          email: email || existingContact.email
        });
        updated++;
        io.emit("contact", { action: "update", contact: existingContact });
      } else {
        duplicates++;
      }
    } else {
      const newContact = await Contact.create({
        name,
        number: cleanNumber,
        email
      });
      imported++;
      io.emit("contact", { action: "create", contact: newContact });
    }
  }

  return {
    imported,
    updated,
    duplicates,
    total: contactsToProcess.length
  };
};

export default ImportCsvContactsService;
