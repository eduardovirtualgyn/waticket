import AppError from "../../errors/AppError";
import Campaign from "../../models/Campaign";
import { stopCampaignExecution } from "./CampaignWorker";
import { getIO } from "../../libs/socket";

const CancelCampaignService = async (id: string | number): Promise<Campaign> => {
  const campaign = await Campaign.findByPk(id);

  if (!campaign) {
    throw new AppError("ERR_NO_CAMPAIGN_FOUND", 404);
  }

  stopCampaignExecution(campaign.id);
  await campaign.update({ status: "CANCELLED" });

  const io = getIO();
  io.emit("campaign", { action: "update", campaignId: campaign.id });

  return campaign;
};

export default CancelCampaignService;
