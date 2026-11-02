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

  let nameIdx = -1;
  let numberIdx = -1;
  let emailIdx = -1;

  let startIndex = 0;

  if (hasHeader) {
    startIndex = 1;
    const headerCols = lines[0]
      .split(delimiter)
      .map(c => c.trim().toLowerCase());
    headerCols.forEach((col, idx) => {
      if (col.includes("nome") || col.includes("name")) nameIdx = idx;
      else if (
        col.includes("tel") ||
        col.includes("cel") ||
        col.includes("phone") ||
        col.includes("num") ||
        col.includes("whats")
      )
        numberIdx = idx;
      else if (col.includes("mail")) emailIdx = idx;
    });
  }

  const result: RawContactInput[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine) continue;

    const parts = rawLine
      .split(delimiter)
      .map(p => p.trim().replace(/^["']|["']$/g, ""));
    if (!parts.length) continue;

    let name = "";
    let number = "";
    let email = "";

    if (nameIdx !== -1 && numberIdx !== -1) {
      name = parts[nameIdx] || "";
      number = parts[numberIdx] || "";
      email = emailIdx !== -1 ? parts[emailIdx] || "" : "";
    } else {
      for (const part of parts) {
        const clean = part.replace(/\D/g, "");
        if (clean.length >= 8 && !number) {
          number = part;
        } else if (part.includes("@") && !email) {
          email = part;
        } else if (!name && isNaN(Number(part))) {
          name = part;
        }
      }
    }

    if (!number) continue;

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
