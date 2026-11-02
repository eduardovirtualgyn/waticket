import Whatsapp from "../../models/Whatsapp";
import Contact from "../../models/Contact";
import { whatsappProvider } from "../../providers/WhatsApp";
import { logger } from "../../utils/logger";
import AppError from "../../errors/AppError";

const ImportGroupsService = async (
  whatsappId?: number
): Promise<{ count: number; total: number }> => {
  let whatsapp: Whatsapp | null = null;

  if (whatsappId) {
    whatsapp = await Whatsapp.findByPk(whatsappId);
  }

  if (!whatsapp) {
    whatsapp = await Whatsapp.findOne({
      where: { status: "CONNECTED" }
    });
  }

  if (!whatsapp) {
    throw new AppError("Nenhuma conexão de WhatsApp ativa encontrada.", 400);
  }

  let groups: Array<{ id: string; name: string }> = [];
  try {
    groups = await whatsappProvider.getGroups(whatsapp.id);
  } catch (err) {
    logger.error(`Could not get whatsapp groups. Err: ${err}`);
    throw new AppError("Não foi possível buscar os grupos do WhatsApp conectado.", 500);
  }

  let count = 0;
  for (const group of groups) {
    if (!group.id) continue;
    const cleanId = group.id.replace("@g.us", "").trim();

    const existing = await Contact.findOne({
      where: { number: cleanId }
    });

    if (existing) {
      await existing.update({
        name: group.name || existing.name,
        isGroup: true
      });
    } else {
      await Contact.create({
        name: group.name || cleanId,
        number: cleanId,
        isGroup: true
      });
      count++;
    }
  }

  return { count, total: groups.length };
};

export default ImportGroupsService;
