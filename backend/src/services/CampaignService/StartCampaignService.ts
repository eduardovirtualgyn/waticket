import AppError from "../../errors/AppError";
import Campaign from "../../models/Campaign";
import Whatsapp from "../../models/Whatsapp";
import { runCampaign } from "./CampaignWorker";
import { getIO } from "../../libs/socket";

const StartCampaignService = async (id: string | number): Promise<Campaign> => {
  const campaign = await Campaign.findByPk(id, {
    include: [
      {
        model: Whatsapp,
        as: "whatsapp"
      }
    ]
  });

  if (!campaign) {
    throw new AppError("ERR_NO_CAMPAIGN_FOUND", 404);
  }

  if (!campaign.whatsapp || campaign.whatsapp.status !== "CONNECTED") {
    throw new AppError("ERR_WHATSAPP_NOT_CONNECTED", 400);
  }

  if (campaign.status === "COMPLETED" || campaign.status === "CANCELLED") {
    throw new AppError("ERR_CAMPAIGN_ALREADY_FINISHED", 400);
  }

  await campaign.update({ status: "PROCESSING" });

  const io = getIO();
  io.emit("campaign", { action: "update", campaignId: campaign.id });

  // Trigger worker asynchronously
  runCampaign(campaign.id);

  return campaign;
};

export default StartCampaignService;
