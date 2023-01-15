import "@logseq/libs";
import { format } from "date-fns";

export const formatDate = async (date: string) => {
  const configs = await logseq.App.getUserConfigs();

  return format(new Date(date), configs.preferredDateFormat);
};
