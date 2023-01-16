import { formatDate } from "./utils/date";

import { getToken } from "./auth";

const QUERY = `
query FetchMyItems {
  myItems(first: 1000) {
    __typename

    id
    title
    sourceUrl
    createdAt
    thumbnailUrl

    ... on RedditItem {
      subreddit
    }
  }
}
`;

type Item = {
  title: string;
  id: string;
  sourceUrl: string;
  createdAt: string;
  thumbnailUrl: string;
} & {
  __typename: "RedditItem";
  subreddit: string;
};

const getTextForItem = (item: Item) => {
  let text = `${item.title}\n`;

  text += `id:: ${item.id}\nurl:: ${item.sourceUrl}\n`;

  if (item.__typename === "RedditItem") {
    text += `subreddit:: #${item.subreddit}\n`;
  }

  return text + "\n";
};

export const sync = async () => {
  const token = getToken();

  if (!token) {
    await logseq.UI.showMsg("You are not authenticated. Please log in.");

    return;
  }

  // TODO: store last sync item id in local storage
  const res = await fetch("http://localhost:8000/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token?.access_token}`,
    },
    body: JSON.stringify({
      query: QUERY,
    }),
  }).then((res) => res.json());

  if (res.errors) {
    let message = "Something went wrong while syncing. Please try again later.";

    if (res.errors[0].message === "You are not authenticated") {
      message = "You are not authenticated. Please log in.";
    }

    await logseq.UI.showMsg(message, "error");

    return;
  }

  await logseq.UI.showMsg("Sync started", "info");

  const itemsToSync = res.data.myItems;

  for (const item of itemsToSync) {
    const pageName = await formatDate(item.createdAt);

    if (await logseq.Editor.getBlock(item.id)) {
      continue;
    }

    const page = await logseq.Editor.getPage(pageName);

    let parentBlock = null;

    if (page !== null) {
      const blocks = await logseq.Editor.getPageBlocksTree(pageName);

      // find block that starts with Codex
      parentBlock = blocks.find((b) => b.content.startsWith("Codex"));

      // manually try to find the item, in case it hasn't been indexed just yet
      if (
        parentBlock &&
        parentBlock.children?.find((block) => {
          // @ts-ignore
          return block.properties?.id === item.id;
        })
      ) {
        console.info(`📚 ${item.id} exists, but hasn't been indexed yet`);

        continue;
      }
    } else {
      await logseq.Editor.createPage(
        pageName,
        {},
        {
          createFirstBlock: false,
          journal: true,
          redirect: false,
        }
      );
    }

    if (!parentBlock) {
      parentBlock = await logseq.Editor.appendBlockInPage(pageName, "Codex");

      console.log("📚", pageName, "doesn't have parent block, creating one");
    }

    if (!parentBlock) {
      console.error("block is null");
    } else {
      const itemBlock = await logseq.Editor.insertBlock(
        parentBlock.uuid,
        getTextForItem(item)
      );

      if (itemBlock && item.thumbnailUrl) {
        logseq.Editor.setBlockCollapsed(itemBlock.uuid, true);

        await logseq.Editor.insertBlock(
          itemBlock.uuid,
          `![](${item.thumbnailUrl})`
        );
      }
    }
  }

  await logseq.UI.showMsg("Sync finished", "success");
};
