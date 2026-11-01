import { Request, Response } from "express";
import AppError from "../errors/AppError";
import CreateCampaignService from "../services/CampaignService/CreateCampaignService";
import ListCampaignsService from "../services/CampaignService/ListCampaignsService";
import ShowCampaignService from "../services/CampaignService/ShowCampaignService";
import DeleteCampaignService from "../services/CampaignService/DeleteCampaignService";
import StartCampaignService from "../services/CampaignService/StartCampaignService";
import PauseCampaignService from "../services/CampaignService/PauseCampaignService";
import CancelCampaignService from "../services/CampaignService/CancelCampaignService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { campaigns } = await ListCampaignsService();
  return res.json({ campaigns });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const {
    name,
    message,
    whatsappId,
    minDelay,
    maxDelay,
    scheduledAt,
    contactIds,
    rawContacts
  } = req.body;

  const media = req.file as Express.Multer.File;

  let parsedContactIds: number[] = [];
  if (contactIds) {
    parsedContactIds = typeof contactIds === "string" ? JSON.parse(contactIds) : contactIds;
  }

  let parsedRawContacts: any[] = [];
  if (rawContacts) {
    parsedRawContacts = typeof rawContacts === "string" ? JSON.parse(rawContacts) : rawContacts;
  }

  const campaign = await CreateCampaignService({
    name,
    message,
    whatsappId: Number(whatsappId),
    userId: Number(req.user.id),
    minDelay: minDelay ? Number(minDelay) : 20,
    maxDelay: maxDelay ? Number(maxDelay) : 45,
    scheduledAt,
    mediaPath: media?.path,
    mediaName: media?.originalname,
    contactIds: parsedContactIds,
    rawContacts: parsedRawContacts
  });

  return res.status(200).json(campaign);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;
  const campaign = await ShowCampaignService(id);
  return res.status(200).json(campaign);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;
  await DeleteCampaignService(id);
  return res.status(200).json({ message: "Campaign deleted" });
};

export const start = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;
  const campaign = await StartCampaignService(id);
  return res.status(200).json(campaign);
};

export const pause = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;
  const campaign = await PauseCampaignService(id);
  return res.status(200).json(campaign);
};

export const cancel = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;
  const campaign = await CancelCampaignService(id);
  return res.status(200).json(campaign);
};
