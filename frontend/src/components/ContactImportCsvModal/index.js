import React, { useState } from "react";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField";
import Paper from "@material-ui/core/Paper";
import Chip from "@material-ui/core/Chip";
import CloudUploadIcon from "@material-ui/icons/CloudUpload";
import GetAppIcon from "@material-ui/icons/GetApp";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import CircularProgress from "@material-ui/core/CircularProgress";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";

import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  uploadBox: {
    border: "2px dashed #3f51b5",
    borderRadius: 8,
    padding: theme.spacing(3),
    textAlign: "center",
    backgroundColor: "rgba(63, 81, 181, 0.04)",
    cursor: "pointer",
    marginBottom: theme.spacing(2),
    transition: "background-color 0.2s",
    "&:hover": {
      backgroundColor: "rgba(63, 81, 181, 0.08)",
    },
  },
  helpBox: {
    padding: theme.spacing(1.5),
    backgroundColor: "#f5f5f5",
    borderRadius: 6,
    marginBottom: theme.spacing(2),
    fontSize: "0.85rem",
    color: "#555",
  },
  modelBtn: {
    marginBottom: theme.spacing(2),
  },
  btnWrapper: {
    position: "relative",
  },
  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
  previewTable: {
    maxHeight: 180,
    overflowY: "auto",
    marginBottom: theme.spacing(2),
  },
}));

const parseCsvText = (content) => {
  if (!content) return [];
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
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
    const headerCols = lines[0].split(delimiter).map((c) => c.trim().toLowerCase());
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

  const result = [];

  for (let i = startIndex; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine) continue;

    const parts = rawLine.split(delimiter).map((p) => p.trim().replace(/^["']|["']$/g, ""));
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

    result.push({
      name: name || cleanNumber,
      number: cleanNumber,
      email: email || "",
    });
  }

  return result;
};

const ContactImportCsvModal = ({ open, onClose, onImport }) => {
  const classes = useStyles();
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedContacts, setParsedContacts] = useState([]);
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const contacts = parseCsvText(text);
      setParsedContacts(contacts);
      if (contacts.length > 0) {
        toast.info(`${contacts.length} contatos identificados no arquivo!`);
      } else {
        toast.warn("Nenhum contato válido encontrado no arquivo. Verifique o formato.");
      }
    };
    reader.readAsText(file);
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setRawText(val);
    const contacts = parseCsvText(val);
    setParsedContacts(contacts);
  };

  const handleDownloadTemplate = () => {
    const csvContent =
      "Nome,Telefone,Email\n" +
      "Exemplo Contato 1,5562999991111,contato1@email.com\n" +
      "Exemplo Contato 2,5562988882222,contato2@email.com\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "modelo_contatos_whaticket.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportSubmit = async () => {
    if (!parsedContacts.length) {
      toast.warn("Nenhum contato válido para importar.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      if (selectedFile) {
        formData.append("file", selectedFile);
      }
      formData.append("contacts", JSON.stringify(parsedContacts));

      const { data } = await api.post("/contacts/import/csv", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success(
        `Sucesso: ${data.imported || 0} contatos criados, ${data.updated || 0} atualizados!`
      );
      handleClose();
      if (onImport) onImport();
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setParsedContacts([]);
    setRawText("");
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Importar Contatos via CSV / TXT</DialogTitle>
      <DialogContent dividers>
        <div className={classes.helpBox}>
          <strong>Formatos aceitos:</strong> Arquivo <code>.csv</code> ou <code>.txt</code>.
          <br />
          Separadores: vírgula (<code>,</code>) ou ponto e vírgula (<code>;</code>).
          <br />
          Colunas: <code>Nome, Telefone, Email</code> (ou apenas o número de telefone).
        </div>

        <Button
          variant="outlined"
          size="small"
          color="secondary"
          startIcon={<GetAppIcon />}
          className={classes.modelBtn}
          onClick={handleDownloadTemplate}
        >
          Baixar Modelo de Exemplo (.CSV)
        </Button>

        <input
          accept=".csv,.txt"
          id="csv-file-input"
          type="file"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        <label htmlFor="csv-file-input">
          <Paper className={classes.uploadBox} variant="outlined">
            <CloudUploadIcon style={{ fontSize: 40, color: "#3f51b5" }} />
            <Typography variant="body1" style={{ marginTop: 8, fontWeight: 500 }}>
              {selectedFile ? selectedFile.name : "Clique para selecionar o arquivo CSV / TXT"}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {selectedFile
                ? `${parsedContacts.length} contatos encontrados`
                : "Compatível com exportação de Excel, Google Contatos e sistemas escolares"}
            </Typography>
          </Paper>
        </label>

        <TextField
          label="Ou cole contatos diretamente aqui (um por linha)"
          multiline
          rows={3}
          variant="outlined"
          fullWidth
          value={rawText}
          onChange={handleTextChange}
          placeholder={"João Silva, 62999998888, joao@email.com\nMaria Santos, 62988887777"}
          style={{ marginBottom: 16 }}
        />

        {parsedContacts.length > 0 && (
          <Paper variant="outlined" className={classes.previewTable}>
            <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircleOutlineIcon style={{ color: green[600] }} fontSize="small" />
              <Typography variant="subtitle2">
                Pré-visualização ({parsedContacts.length} contatos identificados):
              </Typography>
            </div>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>WhatsApp</TableCell>
                  <TableCell>Email</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {parsedContacts.slice(0, 5).map((contact, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{contact.name}</TableCell>
                    <TableCell>{contact.number}</TableCell>
                    <TableCell>{contact.email || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {parsedContacts.length > 5 && (
              <Typography variant="caption" style={{ padding: "4px 12px", display: "block" }}>
                ...e mais {parsedContacts.length - 5} contatos.
              </Typography>
            )}
          </Paper>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="default" disabled={loading}>
          Cancelar
        </Button>
        <div className={classes.btnWrapper}>
          <Button
            onClick={handleImportSubmit}
            color="primary"
            variant="contained"
            disabled={loading || parsedContacts.length === 0}
          >
            Importar {parsedContacts.length > 0 ? `(${parsedContacts.length})` : ""}
          </Button>
          {loading && <CircularProgress size={24} className={classes.buttonProgress} />}
        </div>
      </DialogActions>
    </Dialog>
  );
};

export default ContactImportCsvModal;
