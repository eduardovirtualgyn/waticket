import AppError from "../../errors/AppError";
import Campaign from "../../models/Campaign";
import CampaignShipping from "../../models/CampaignShipping";
import Contact from "../../models/Contact";

interface RawContact {
  number: string;
  name?: string;
}

interface Request {
  name: string;
  message: string;
  whatsappId: number;
  userId: number;
  minDelay?: number;
  maxDelay?: number;
  scheduledAt?: string | Date;
  mediaPath?: string;
  mediaName?: string;
  contactIds?: number[];
  rawContacts?: RawContact[];
}

const CreateCampaignService = async ({
  name,
  message,
  whatsappId,
  userId,
  minDelay = 20,
  maxDelay = 45,
  scheduledAt,
  mediaPath,
  mediaName,
  contactIds = [],
  rawContacts = []
}: Request): Promise<Campaign> => {
  if (!name || !message || !whatsappId) {
    throw new AppError("ERR_CAMPAIGN_INVALID_DATA", 400);
  }

  const campaign = await Campaign.create({
    name,
    message,
    whatsappId,
    userId,
    minDelay,
    maxDelay,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    mediaPath,
    mediaName,
    status: "PENDING"
  });

  const shippingsToCreate: Array<{
    campaignId: number;
    contactId?: number;
    number: string;
    name?: string;
    status: string;
  }> = [];

  const addedNumbers = new Set<string>();

  // Add contacts selected from existing contacts list
  if (contactIds && contactIds.length > 0) {
    const contacts = await Contact.findAll({
      where: {
        id: contactIds
      }
    });

    for (const c of contacts) {
      const isGroup = !!c.isGroup || c.number.includes("-") || c.number.endsWith("@g.us");
      const cleanNumber = isGroup
        ? c.number.replace("@g.us", "").trim()
        : c.number.replace(/\D/g, "");

      if (cleanNumber && !addedNumbers.has(cleanNumber)) {
        addedNumbers.add(cleanNumber);
        shippingsToCreate.push({
          campaignId: campaign.id,
          contactId: c.id,
          number: cleanNumber,
          name: c.name || cleanNumber,
          status: "PENDING"
        });
      }
    }
  }

  // Add raw contacts (from pasted text or CSV)
  if (rawContacts && rawContacts.length > 0) {
    for (const raw of rawContacts) {
      if (!raw.number) continue;
      const isGroup = String(raw.number).includes("@g.us") || String(raw.number).includes("-");
      const cleanNumber = isGroup
        ? String(raw.number).replace("@g.us", "").trim()
        : String(raw.number).replace(/\D/g, "");

      if (cleanNumber.length >= 8 && !addedNumbers.has(cleanNumber)) {
        addedNumbers.add(cleanNumber);
        shippingsToCreate.push({
          campaignId: campaign.id,
          number: cleanNumber,
          name: raw.name || cleanNumber,
          status: "PENDING"
        });
      }
    }
  }

  if (shippingsToCreate.length > 0) {
    await CampaignShipping.bulkCreate(shippingsToCreate);
  }

  return campaign;
};

export default CreateCampaignService;
