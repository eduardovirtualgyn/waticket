import AppError from "../../errors/AppError";
import Campaign from "../../models/Campaign";
import CampaignShipping from "../../models/CampaignShipping";
import Whatsapp from "../../models/Whatsapp";
import User from "../../models/User";

const ShowCampaignService = async (id: string | number): Promise<Campaign> => {
  const campaign = await Campaign.findByPk(id, {
    include: [
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["id", "name", "status"]
      },
      {
        model: User,
        as: "user",
        attributes: ["id", "name"]
      },
      {
        model: CampaignShipping,
        as: "shippings",
        order: [["id", "ASC"]]
      }
    ]
  });

  if (!campaign) {
    throw new AppError("ERR_NO_CAMPAIGN_FOUND", 404);
  }

  return campaign;
};

export default ShowCampaignService;
