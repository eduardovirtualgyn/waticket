import Campaign from "../../models/Campaign";
import CampaignShipping from "../../models/CampaignShipping";
import Whatsapp from "../../models/Whatsapp";
import User from "../../models/User";

interface Response {
  campaigns: any[];
}

const ListCampaignsService = async (): Promise<Response> => {
  const campaigns = await Campaign.findAll({
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
        attributes: ["id", "status"]
      }
    ],
    order: [["createdAt", "DESC"]]
  });

  const serialized = campaigns.map(c => {
    const shippings = c.shippings || [];
    const total = shippings.length;
    const delivered = shippings.filter(s => s.status === "DELIVERED").length;
    const failed = shippings.filter(s => s.status === "FAILED").length;
    const pending = total - delivered - failed;

    return {
      id: c.id,
      name: c.name,
      message: c.message,
      status: c.status,
      scheduledAt: c.scheduledAt,
      completedAt: c.completedAt,
      mediaPath: c.mediaPath,
      mediaName: c.mediaName,
      minDelay: c.minDelay,
      maxDelay: c.maxDelay,
      whatsappId: c.whatsappId,
      whatsapp: c.whatsapp,
      userId: c.userId,
      user: c.user,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      stats: {
        total,
        delivered,
        failed,
        pending,
        percent: total > 0 ? Math.round((delivered / total) * 100) : 0
      }
    };
  });

  return { campaigns: serialized };
};

export default ListCampaignsService;
