import path from "path";
import Campaign from "../../models/Campaign";
import CampaignShipping from "../../models/CampaignShipping";
import Whatsapp from "../../models/Whatsapp";
import Contact from "../../models/Contact";
import { whatsappProvider } from "../../providers/WhatsApp";
import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import CreateMessageService from "../MessageServices/CreateMessageService";

const activeCampaignTimers: Map<number, NodeJS.Timeout> = new Map();

const getMimetypeFromPath = (filePath: string): string => {
  const ext = path.extname(filePath).toLowerCase().replace(".", "");
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    pdf: "application/pdf",
    mp3: "audio/mp3",
    ogg: "audio/ogg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    aac: "audio/aac",
    mp4: "video/mp4",
    avi: "video/x-msvideo",
    mov: "video/quicktime",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
    csv: "text/csv",
    zip: "application/zip",
    rar: "application/x-rar-compressed"
  };
  return mimeMap[ext] || "application/octet-stream";
};

export const stopCampaignExecution = (campaignId: number): void => {
  const timer = activeCampaignTimers.get(campaignId);
  if (timer) {
    clearTimeout(timer);
    activeCampaignTimers.delete(campaignId);
  }
};

export const runCampaign = async (campaignId: number): Promise<void> => {
  stopCampaignExecution(campaignId);

  const campaign = await Campaign.findByPk(campaignId, {
    include: [
      {
        model: Whatsapp,
        as: "whatsapp"
      }
    ]
  });

  if (!campaign || campaign.status !== "PROCESSING") {
    return;
  }

  // Check if WhatsApp connection is available
  if (!campaign.whatsapp || campaign.whatsapp.status !== "CONNECTED") {
    logger.warn(`Campaign #${campaignId} paused: WhatsApp #${campaign.whatsappId} is not CONNECTED.`);
    await campaign.update({ status: "PAUSED" });
    const io = getIO();
    io.emit("campaign", { action: "update", campaignId });
    return;
  }

  // Find next pending contact to send
  const shipping = await CampaignShipping.findOne({
    where: {
      campaignId,
      status: "PENDING"
    },
    order: [["id", "ASC"]]
  });

  if (!shipping) {
    // Campaign finished
    await campaign.update({
      status: "COMPLETED",
      completedAt: new Date()
    });
    const io = getIO();
    io.emit("campaign", { action: "update", campaignId });
    logger.info(`Campaign #${campaignId} COMPLETED successfully.`);
    return;
  }

  try {
    await shipping.update({ status: "PROCESSING" });

    const isGroupNumber =
      shipping.number.includes("-") ||
      shipping.number.endsWith("@g.us") ||
      shipping.number.length >= 17;

    const cleanNumber = isGroupNumber
      ? shipping.number.replace("@g.us", "").trim()
      : shipping.number.replace(/\D/g, "");

    const contactName = shipping.name || cleanNumber;

    // Personalize variables
    const personalizedBody = (campaign.message || "")
      .replace(/{nome}/gi, contactName)
      .replace(/{name}/gi, contactName)
      .replace(/{numero}/gi, cleanNumber)
      .replace(/{number}/gi, cleanNumber);

    // Register / update contact
    let contact: Contact;
    if (shipping.contactId) {
      const found = await Contact.findByPk(shipping.contactId);
      contact =
        found ||
        (await CreateOrUpdateContactService({
          name: contactName,
          number: cleanNumber,
          isGroup: isGroupNumber
        }));
    } else {
      contact = await CreateOrUpdateContactService({
        name: contactName,
        number: cleanNumber,
        isGroup: isGroupNumber
      });
      await shipping.update({ contactId: contact.id });
    }

    const isGroup = !!contact.isGroup || isGroupNumber;
    const ticket = await FindOrCreateTicketService(
      contact,
      campaign.whatsappId,
      0,
      isGroup ? contact : undefined
    );
    SetTicketMessagesAsRead(ticket);

    const chatId = isGroup ? `${cleanNumber}@g.us` : `${cleanNumber}@c.us`;

    if (campaign.mediaPath) {
      const mediaMime = getMimetypeFromPath(campaign.mediaPath);
      await whatsappProvider.sendMedia(
        campaign.whatsappId,
        chatId,
        {
          filename: campaign.mediaName || path.basename(campaign.mediaPath),
          mimetype: mediaMime,
          path: campaign.mediaPath
        },
        {
          caption: personalizedBody
        }
      );

      await CreateMessageService({
        messageData: {
          id: `camp_${shipping.id}_${Date.now()}`,
          ticketId: ticket.id,
          body: personalizedBody || campaign.mediaName,
          fromMe: true,
          read: true,
          mediaType: mediaMime.startsWith("image") ? "image" : "document",
          mediaUrl: path.basename(campaign.mediaPath)
        }
      });
    } else {
      await whatsappProvider.sendMessage(campaign.whatsappId, chatId, personalizedBody);

      await CreateMessageService({
        messageData: {
          id: `camp_${shipping.id}_${Date.now()}`,
          ticketId: ticket.id,
          body: personalizedBody,
          fromMe: true,
          read: true
        }
      });
    }

    await shipping.update({
      status: "DELIVERED",
      deliveredAt: new Date(),
      message: personalizedBody
    });

    logger.info(`Campaign #${campaignId}: sent message to ${cleanNumber}`);
  } catch (err: any) {
    logger.error(`Error sending campaign shipping #${shipping.id}: ${err.message}`);
    await shipping.update({
      status: "FAILED",
      error: err.message || "Unknown error"
    });
  }

  // Notify frontend in real-time
  const io = getIO();
  io.emit("campaign", { action: "update", campaignId });

  // Moderate and safe anti-ban delay (defaults 20-45s)
  const min = Math.max(5, campaign.minDelay || 20);
  const max = Math.max(min, campaign.maxDelay || 45);
  const randomDelayMs = Math.floor(Math.random() * (max - min + 1) + min) * 1000;

  logger.info(`Campaign #${campaignId}: waiting ${randomDelayMs / 1000}s anti-ban delay before next message...`);

  const timer = setTimeout(() => {
    runCampaign(campaignId);
  }, randomDelayMs);

  activeCampaignTimers.set(campaignId, timer);
};
