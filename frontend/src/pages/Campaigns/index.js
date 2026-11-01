import React, { useState, useEffect } from "react";
import openSocket from "../../services/socket-io";

import {
  Button,
  IconButton,
  makeStyles,
  Paper,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  Typography,
  Box,
  Tooltip
} from "@material-ui/core";
import {
  PlayArrow,
  Pause,
  Stop,
  Visibility,
  DeleteOutline,
  Add
} from "@material-ui/icons";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import ResponsiveTable from "../../components/ResponsiveTable";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ConfirmationModal from "../../components/ConfirmationModal";
import CampaignModal from "../../components/CampaignModal";
import CampaignReportModal from "../../components/CampaignReportModal";

import api from "../../services/api";
import { toast } from "react-toastify";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  statusChip: {
    fontWeight: 500,
  }
}));

const Campaigns = () => {
  const classes = useStyles();

  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState([]);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");

  const loadCampaigns = async () => {
    try {
      const res = await api.get("/campaigns");
      setCampaigns(res.data.campaigns || []);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      toastError(err);
    }
  };

  useEffect(() => {
    loadCampaigns();

    const socket = openSocket();

    socket.on("campaign", (data) => {
      if (data.action === "update") {
        loadCampaigns();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleStartCampaign = async (id) => {
    try {
      await api.post(`/campaigns/${id}/start`);
      toast.success("Disparo de campanha iniciado!");
      loadCampaigns();
    } catch (err) {
      toastError(err);
    }
  };

  const handlePauseCampaign = async (id) => {
    try {
      await api.post(`/campaigns/${id}/pause`);
      toast.info("Campanha pausada.");
      loadCampaigns();
    } catch (err) {
      toastError(err);
    }
  };

  const handleCancelCampaign = (id) => {
    setConfirmTitle("Cancelar Campanha?");
    setConfirmMessage("Deseja realmente cancelar os envios pendentes desta campanha?");
    setConfirmAction(() => async () => {
      try {
        await api.post(`/campaigns/${id}/cancel`);
        toast.info("Campanha cancelada.");
        loadCampaigns();
      } catch (err) {
        toastError(err);
      }
    });
    setConfirmModalOpen(true);
  };

  const handleDeleteCampaign = (id) => {
    setConfirmTitle("Excluir Campanha?");
    setConfirmMessage("Deseja realmente excluir esta campanha e todo o seu histórico?");
    setConfirmAction(() => async () => {
      try {
        await api.delete(`/campaigns/${id}`);
        toast.success("Campanha excluída com sucesso.");
        loadCampaigns();
      } catch (err) {
        toastError(err);
      }
    });
    setConfirmModalOpen(true);
  };

  const handleOpenReport = (id) => {
    setSelectedCampaignId(id);
    setReportModalOpen(true);
  };

  const renderStatus = (status) => {
    switch (status) {
      case "PROCESSING":
        return <Chip label="Em Andamento" size="small" style={{ backgroundColor: "#e3f2fd", color: "#1976d2" }} />;
      case "PAUSED":
        return <Chip label="Pausada" size="small" style={{ backgroundColor: "#fff3e0", color: "#f57c00" }} />;
      case "COMPLETED":
        return <Chip label="Concluída" size="small" style={{ backgroundColor: "#e8f5e9", color: "#2e7d32" }} />;
      case "CANCELLED":
        return <Chip label="Cancelada" size="small" style={{ backgroundColor: "#ffebee", color: "#c62828" }} />;
      case "PENDING":
      default:
        return <Chip label="Aguardando Início" size="small" style={{ backgroundColor: "#f5f5f5", color: "#616161" }} />;
    }
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={confirmTitle}
        open={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={() => {
          if (confirmAction) confirmAction();
          setConfirmModalOpen(false);
        }}
      >
        {confirmMessage}
      </ConfirmationModal>

      <CampaignModal
        open={campaignModalOpen}
        onClose={() => setCampaignModalOpen(false)}
        onSave={loadCampaigns}
      />

      <CampaignReportModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        campaignId={selectedCampaignId}
      />

      <MainHeader>
        <Title>Campanhas de Disparo em Massa</Title>
        <MainHeaderButtonsWrapper>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Add />}
            onClick={() => setCampaignModalOpen(true)}
          >
            Nova Campanha
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Paper className={classes.mainPaper} variant="outlined">
        <ResponsiveTable>
          <TableHead>
            <TableRow>
              <TableCell>Campanha</TableCell>
              <TableCell>Conexão (Chip)</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell style={{ minWidth: 200 }}>Progresso</TableCell>
              <TableCell align="center">Anti-Ban</TableCell>
              <TableCell align="center">Criado em</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRowSkeleton columns={7} />
            ) : (
              campaigns.map((camp) => (
                <TableRow key={camp.id} hover>
                  <TableCell>
                    <Typography variant="subtitle2">{camp.name}</Typography>
                    {camp.mediaName && (
                      <Typography variant="caption" color="textSecondary">
                        📎 {camp.mediaName}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{camp.whatsapp?.name || "Padrão"}</TableCell>
                  <TableCell align="center">{renderStatus(camp.status)}</TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gridGap={8}>
                      <Box width="100%">
                        <LinearProgress
                          variant="determinate"
                          value={camp.stats.percent}
                          className={classes.progressBar}
                          color={camp.status === "COMPLETED" ? "primary" : "secondary"}
                        />
                      </Box>
                      <Box minWidth={65}>
                        <Typography variant="body2" color="textSecondary">
                          {camp.stats.percent}%
                        </Typography>
                      </Box>
                    </Box>
                    <Typography variant="caption" color="textSecondary">
                      {camp.stats.delivered} de {camp.stats.total} enviados ({camp.stats.failed} falhas)
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="caption">
                      {camp.minDelay}s - {camp.maxDelay}s
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    {new Date(camp.createdAt).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell align="right">
                    {(camp.status === "PENDING" || camp.status === "PAUSED") && (
                      <Tooltip title="Iniciar Envio">
                        <IconButton
                          size="small"
                          onClick={() => handleStartCampaign(camp.id)}
                          style={{ color: "#2e7d32" }}
                        >
                          <PlayArrow />
                        </IconButton>
                      </Tooltip>
                    )}
                    {camp.status === "PROCESSING" && (
                      <Tooltip title="Pausar Envio">
                        <IconButton
                          size="small"
                          onClick={() => handlePauseCampaign(camp.id)}
                          style={{ color: "#f57c00" }}
                        >
                          <Pause />
                        </IconButton>
                      </Tooltip>
                    )}
                    {(camp.status === "PROCESSING" || camp.status === "PAUSED") && (
                      <Tooltip title="Cancelar Campanha">
                        <IconButton
                          size="small"
                          onClick={() => handleCancelCampaign(camp.id)}
                          color="secondary"
                        >
                          <Stop />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Ver Relatório Detalhado">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenReport(camp.id)}
                      >
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Excluir">
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteCampaign(camp.id)}
                      >
                        <DeleteOutline />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
            {!loading && campaigns.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Box p={3}>
                    <Typography variant="subtitle1" color="textSecondary" gutterBottom>
                      Nenhuma campanha cadastrada.
                    </Typography>
                    <Button
                      variant="outlined"
                      color="primary"
                      startIcon={<Add />}
                      onClick={() => setCampaignModalOpen(true)}
                    >
                      Criar sua primeira campanha
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </ResponsiveTable>
      </Paper>
    </MainContainer>
  );
};

export default Campaigns;
