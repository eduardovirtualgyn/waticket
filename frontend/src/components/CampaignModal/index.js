import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Box,
  Typography,
  Chip,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Paper,
  CircularProgress,
  FormControlLabel
} from "@material-ui/core";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import CloudUploadIcon from "@material-ui/icons/CloudUpload";
import api from "../../services/api";
import { toast } from "react-toastify";
import toastError from "../../errors/toastError";

const CampaignModal = ({ open, onClose, onSave }) => {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [whatsapps, setWhatsapps] = useState([]);
  const [contacts, setContacts] = useState([]);

  // Campaign Form State
  const [name, setName] = useState("");
  const [whatsappId, setWhatsappId] = useState("");
  const [message, setMessage] = useState("");
  const [minDelay, setMinDelay] = useState(20);
  const [maxDelay, setMaxDelay] = useState(45);
  const [media, setMedia] = useState(null);

  // Recipients State
  const [rawTextNumbers, setRawTextNumbers] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [searchContact, setSearchContact] = useState("");
  const [showOnlySelected, setShowOnlySelected] = useState(false);

  useEffect(() => {
    if (open) {
      // Reset form
      setName("");
      setMessage("");
      setMedia(null);
      setMinDelay(20);
      setMaxDelay(45);
      setRawTextNumbers("");
      setSelectedContactIds([]);
      setSearchContact("");
      setShowOnlySelected(false);
      setTab(0);

      // Load Whatsapps
      api.get("/whatsapp").then((res) => {
        setWhatsapps(res.data || []);
        const defaultWapp = res.data.find((w) => w.isDefault && w.status === "CONNECTED") || res.data[0];
        if (defaultWapp) {
          setWhatsappId(defaultWapp.id);
        }
      });

      // Load contacts
      api.get("/contacts/list").then((res) => {
        setContacts(res.data || []);
      }).catch(() => {
        // Fallback if list endpoint not available
        api.get("/contacts?pageNumber=1").then((res) => {
          setContacts(res.data.contacts || []);
        });
      });
    }
  }, [open]);

  // Handle CSV/TXT File Upload to paste into rawTextNumbers
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const extracted = [];
      for (const line of lines) {
        const parts = line.split(/[,;\t]/).map((p) => p.trim().replace(/^["']|["']$/g, ""));
        let num = "";
        let nm = "";
        for (const p of parts) {
          const clean = p.replace(/\D/g, "");
          if (clean.length >= 8 && clean.length <= 15 && !num) {
            num = clean.length === 10 || clean.length === 11 ? "55" + clean : clean;
          } else if (!nm && isNaN(Number(p)) && !p.includes("@") && !p.includes("http")) {
            nm = p;
          }
        }
        if (num) {
          extracted.push(nm ? `${num}, ${nm}` : num);
        }
      }

      if (extracted.length > 0) {
        const newText = extracted.join("\n");
        setRawTextNumbers((prev) => (prev ? prev + "\n" + newText : newText));
        toast.success(`${extracted.length} contatos extraídos do arquivo para a campanha!`);
      } else {
        setRawTextNumbers((prev) => (prev ? prev + "\n" + content : content));
        toast.info("Arquivo carregado.");
      }
    };
    reader.readAsText(file);
  };

  // Calculate parsed recipients count
  const parsedRawCount = rawTextNumbers
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.replace(/\D/g, "").length >= 8).length;

  const totalRecipients = parsedRawCount + selectedContactIds.length;

  const handleToggleContact = (id) => {
    setSelectedContactIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const filteredContacts = contacts.filter((c) => {
    if (showOnlySelected && !selectedContactIds.includes(c.id)) {
      return false;
    }
    if (!searchContact) return true;
    return (
      c.name?.toLowerCase().includes(searchContact.toLowerCase()) ||
      c.number?.includes(searchContact)
    );
  });

  const allFilteredSelected =
    filteredContacts.length > 0 &&
    filteredContacts.every((c) => selectedContactIds.includes(c.id));

  const handleSelectAllContacts = () => {
    if (allFilteredSelected) {
      // Remove da seleção apenas os contatos que estão no filtro atual
      const filteredIds = new Set(filteredContacts.map((c) => c.id));
      setSelectedContactIds((prev) =>
        prev.filter((id) => !filteredIds.has(id))
      );
    } else {
      // Adiciona todos os contatos do filtro mantendo os selecionados anteriormente
      const newIds = filteredContacts.map((c) => c.id);
      setSelectedContactIds((prev) => Array.from(new Set([...prev, ...newIds])));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Informe o nome da campanha.");
      return;
    }
    if (!whatsappId) {
      toast.error("Selecione a conexão do WhatsApp.");
      return;
    }
    if (!message.trim() && !media) {
      toast.error("Informe uma mensagem de texto ou anexe uma mídia.");
      return;
    }
    if (totalRecipients === 0) {
      toast.error("Adicione ao menos um destinatário na aba Destinatários.");
      setTab(1);
      return;
    }

    setLoading(true);

    try {
      // Parse raw text contacts (number, name)
      const rawContacts = rawTextNumbers
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => {
          const parts = line.split(/[,;\t]/);
          const number = parts[0]?.trim();
          const contactName = parts[1]?.trim() || "";
          return { number, name: contactName };
        })
        .filter((c) => c.number.replace(/\D/g, "").length >= 8);

      const formData = new FormData();
      formData.append("name", name);
      formData.append("whatsappId", whatsappId);
      formData.append("message", message);
      formData.append("minDelay", minDelay);
      formData.append("maxDelay", maxDelay);
      formData.append("contactIds", JSON.stringify(selectedContactIds));
      formData.append("rawContacts", JSON.stringify(rawContacts));

      if (media) {
        formData.append("media", media);
      }

      await api.post("/campaigns", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      toast.success("Campanha criada com sucesso!");
      setLoading(false);
      onSave();
      onClose();
    } catch (err) {
      setLoading(false);
      toastError(err);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Nova Campanha de Disparo</DialogTitle>
      <form onSubmit={handleSubmit}>
        <Tabs
          value={tab}
          onChange={(e, val) => setTab(val)}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="1. Mensagem & Disparo" />
          <Tab
            label={
              <Box display="flex" alignItems="center">
                2. Destinatários
                {totalRecipients > 0 && (
                  <Chip
                    size="small"
                    label={totalRecipients}
                    color="primary"
                    style={{ marginLeft: 8 }}
                  />
                )}
              </Box>
            }
          />
        </Tabs>

        <DialogContent dividers>
          {tab === 0 && (
            <Box display="flex" flexDirection="column" gridGap={16}>
              <TextField
                label="Nome da Campanha"
                variant="outlined"
                fullWidth
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Promoção de Black Friday"
              />

              <FormControl variant="outlined" fullWidth required>
                <InputLabel>Conexão WhatsApp (Chip de Envio)</InputLabel>
                <Select
                  value={whatsappId}
                  onChange={(e) => setWhatsappId(e.target.value)}
                  label="Conexão WhatsApp (Chip de Envio)"
                >
                  {whatsapps.map((w) => (
                    <MenuItem key={w.id} value={w.id}>
                      {w.name} ({w.status === "CONNECTED" ? "🟢 Conectado" : "🔴 " + w.status})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle2">Mensagem</Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setMessage((prev) => prev + " {nome}")}
                  >
                    + Inserir {"{nome}"}
                  </Button>
                </Box>
                <TextField
                  variant="outlined"
                  multiline
                  rows={5}
                  fullWidth
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Olá {nome}! Tudo bem? Temos uma novidade especial para você..."
                  helperText="Dica: Use a tag {nome} para personalizar a mensagem com o nome do contato."
                />
              </Box>

              <Box display="flex" alignItems="center" gridGap={16}>
                <input
                  type="file"
                  id="campaign-media-upload"
                  style={{ display: "none" }}
                  onChange={(e) => setMedia(e.target.files[0])}
                />
                <label htmlFor="campaign-media-upload">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<AttachFileIcon />}
                  >
                    {media ? "Substituir Anexo" : "Anexar Mídia (Imagem/PDF/Áudio)"}
                  </Button>
                </label>
                {media && (
                  <Chip
                    label={media.name}
                    onDelete={() => setMedia(null)}
                    color="secondary"
                  />
                )}
              </Box>

              <Box mt={1} p={2} style={{ backgroundColor: "#f5f5f5", borderRadius: 8 }}>
                <Typography variant="subtitle2" gutterBottom>
                  🛡️ Intervalo Anti-Ban (Delay aleatório entre envios)
                </Typography>
                <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
                  O sistema aguardará um tempo aleatório entre os segundos mínimo e máximo antes de disparar cada mensagem, simulando a digitação humana.
                </Typography>
                <Box display="flex" gridGap={16} mt={1}>
                  <TextField
                    label="Mínimo (segundos)"
                    type="number"
                    variant="outlined"
                    size="small"
                    value={minDelay}
                    onChange={(e) => setMinDelay(Number(e.target.value))}
                  />
                  <TextField
                    label="Máximo (segundos)"
                    type="number"
                    variant="outlined"
                    size="small"
                    value={maxDelay}
                    onChange={(e) => setMaxDelay(Number(e.target.value))}
                  />
                </Box>
              </Box>
            </Box>
          )}

          {tab === 1 && (
            <Box display="flex" flexDirection="column" gridGap={16}>
              <Box p={2} style={{ backgroundColor: "#e3f2fd", borderRadius: 8 }}>
                <Typography variant="subtitle2" style={{ color: "#0d47a1" }}>
                  Destinatários da Campanha: {totalRecipients} contato(s)
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Você pode colar números diretamente, subir uma planilha/arquivo de texto ou selecionar contatos da sua agenda.
                </Typography>
              </Box>

              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle2">
                    Opção A: Colar Números ou Importar Arquivo
                  </Typography>
                  <label htmlFor="upload-contacts-file">
                    <input
                      id="upload-contacts-file"
                      type="file"
                      accept=".csv,.txt"
                      style={{ display: "none" }}
                      onChange={handleFileUpload}
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      component="span"
                      startIcon={<CloudUploadIcon />}
                    >
                      Upload .CSV / .TXT
                    </Button>
                  </label>
                </Box>
                <TextField
                  variant="outlined"
                  multiline
                  rows={5}
                  fullWidth
                  value={rawTextNumbers}
                  onChange={(e) => setRawTextNumbers(e.target.value)}
                  placeholder="Cole um número por linha (com DDD). Exemplos:&#10;5511999998888, João Silva&#10;5521988887777&#10;5531977776666, Maria"
                  helperText={`Números válidos identificados no texto: ${parsedRawCount}`}
                />
              </Box>

              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle2">
                    Opção B: Selecionar da Agenda de Contatos
                  </Typography>
                  <Typography variant="body2" style={{ fontWeight: 600, color: "#3f51b5" }}>
                    {selectedContactIds.length} selecionado(s) de {contacts.length} cadastrados
                  </Typography>
                </Box>

                <Box display="flex" gridGap={8} mb={1} alignItems="center">
                  <TextField
                    placeholder="Pesquisar contatos (ex: turma ou nome)..."
                    variant="outlined"
                    size="small"
                    fullWidth
                    value={searchContact}
                    onChange={(e) => setSearchContact(e.target.value)}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    color="primary"
                    style={{ whiteSpace: "nowrap" }}
                    onClick={handleSelectAllContacts}
                    disabled={filteredContacts.length === 0}
                  >
                    {allFilteredSelected
                      ? searchContact
                        ? `Desmarcar Filtrados (${filteredContacts.length})`
                        : "Desmarcar Todos"
                      : searchContact
                      ? `Selecionar Filtrados (${filteredContacts.length})`
                      : "Selecionar Todos"}
                  </Button>
                  {selectedContactIds.length > 0 && (
                    <Button
                      size="small"
                      variant="text"
                      color="secondary"
                      style={{ whiteSpace: "nowrap" }}
                      onClick={() => setSelectedContactIds([])}
                    >
                      Limpar ({selectedContactIds.length})
                    </Button>
                  )}
                </Box>

                {selectedContactIds.length > 0 && (
                  <Box display="flex" alignItems="center" mb={1}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={showOnlySelected}
                          onChange={(e) => setShowOnlySelected(e.target.checked)}
                          color="primary"
                        />
                      }
                      label={
                        <Typography variant="caption" style={{ fontWeight: 500 }}>
                          Ver apenas contatos selecionados ({selectedContactIds.length})
                        </Typography>
                      }
                    />
                  </Box>
                )}

                <Paper variant="outlined" style={{ maxHeight: 200, overflowY: "auto" }}>
                  <List dense>
                    {filteredContacts.map((c) => (
                      <ListItem
                        key={c.id}
                        button
                        onClick={() => handleToggleContact(c.id)}
                      >
                        <ListItemIcon>
                          <Checkbox
                            edge="start"
                            checked={selectedContactIds.includes(c.id)}
                            tabIndex={-1}
                            disableRipple
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={c.name}
                          secondary={c.number}
                        />
                      </ListItem>
                    ))}
                    {filteredContacts.length === 0 && (
                      <ListItem>
                        <ListItemText secondary="Nenhum contato encontrado." />
                      </ListItem>
                    )}
                  </List>
                </Paper>
              </Box>
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} color="default" disabled={loading}>
            Cancelar
          </Button>
          {tab === 0 ? (
            <Button
              onClick={() => setTab(1)}
              color="primary"
              variant="contained"
            >
              Próximo: Destinatários ➔
            </Button>
          ) : (
            <Button
              type="submit"
              color="primary"
              variant="contained"
              disabled={loading}
              startIcon={loading && <CircularProgress size={20} />}
            >
              Criar Campanha
            </Button>
          )}
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default CampaignModal;
