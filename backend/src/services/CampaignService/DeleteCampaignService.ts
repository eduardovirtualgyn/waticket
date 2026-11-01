import AppError from "../../errors/AppError";
import Campaign from "../../models/Campaign";
import { stopCampaignExecution } from "./CampaignWorker";

const DeleteCampaignService = async (id: string | number): Promise<void> => {
  const campaign = await Campaign.findByPk(id);

  if (!campaign) {
    throw new AppError("ERR_NO_CAMPAIGN_FOUND", 404);
  }

  stopCampaignExecution(campaign.id);
  await campaign.destroy();
};

export default DeleteCampaignService;
