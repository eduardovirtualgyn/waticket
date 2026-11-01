import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Paper,
  CircularProgress
} from "@material-ui/core";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import ErrorIcon from "@material-ui/icons/Error";
import HourglassEmptyIcon from "@material-ui/icons/HourglassEmpty";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const CampaignReportModal = ({ open, onClose, campaignId }) => {
  const [loading, setLoading] = useState(false);
  const [campaign, setCampaign] = useState(null);

  useEffect(() => {
    if (open && campaignId) {
      setLoading(true);
      api
        .get(`/campaigns/${campaignId}`)
        .then((res) => {
          setCampaign(res.data);
          setLoading(false);
        })
        .catch((err) => {
          setLoading(false);
          toastError(err);
        });
    }
  }, [open, campaignId]);

  if (!open) return null;

  const shippings = campaign?.shippings || [];
  const total = shippings.length;
  const delivered = shippings.filter((s) => s.status === "DELIVERED").length;
  const failed = shippings.filter((s) => s.status === "FAILED").length;
  const pending = total - delivered - failed;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Relatório da Campanha: {campaign?.name || "Carregando..."}
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Box display="flex" justifyContent="space-around" mb={3}>
              <Box textAlign="center">
                <Typography variant="h6">{total}</Typography>
                <Typography variant="body2" color="textSecondary">
                  Total
                </Typography>
              </Box>
              <Box textAlign="center">
                <Typography variant="h6" style={{ color: "#4caf50" }}>
                  {delivered}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Enviadas
                </Typography>
              </Box>
              <Box textAlign="center">
                <Typography variant="h6" style={{ color: "#f44336" }}>
                  {failed}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Falhas
                </Typography>
              </Box>
              <Box textAlign="center">
                <Typography variant="h6" style={{ color: "#ff9800" }}>
                  {pending}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Pendentes
                </Typography>
              </Box>
            </Box>

            <Paper variant="outlined" style={{ maxHeight: 350, overflowY: "auto" }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Número</TableCell>
                    <TableCell>Nome</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Enviado em</TableCell>
                    <TableCell>Detalhes / Erro</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shippings.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.number}</TableCell>
                      <TableCell>{item.name || "-"}</TableCell>
                      <TableCell>
                        {item.status === "DELIVERED" && (
                          <Chip
                            icon={<CheckCircleIcon />}
                            label="Enviado"
                            size="small"
                            style={{ backgroundColor: "#e8f5e9", color: "#2e7d32" }}
                          />
                        )}
                        {item.status === "FAILED" && (
                          <Chip
                            icon={<ErrorIcon />}
                            label="Falhou"
                            size="small"
                            style={{ backgroundColor: "#ffebee", color: "#c62828" }}
                          />
                        )}
                        {item.status === "PENDING" && (
                          <Chip
                            icon={<HourglassEmptyIcon />}
                            label="Pendente"
                            size="small"
                            style={{ backgroundColor: "#fff3e0", color: "#ef6c00" }}
                          />
                        )}
                        {item.status === "PROCESSING" && (
                          <Chip
                            label="Enviando..."
                            size="small"
                            color="primary"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {item.deliveredAt
                          ? new Date(item.deliveredAt).toLocaleString("pt-BR")
                          : "-"}
                      </TableCell>
                      <TableCell style={{ color: item.error ? "#c62828" : "inherit" }}>
                        {item.error || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {shippings.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        Nenhum destinatário encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary" variant="contained">
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CampaignReportModal;
