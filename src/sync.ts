import { formatDate } from "./utils/date";

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
  const res = await fetch("http://localhost:8000/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: QUERY,
    }),
  }).then((res) => res.json());

  const itemsToSync = res.data.myItems;

  for (const item of itemsToSync) {
    const pageName = await formatDate(item.createdAt);

    // this needs sync
    if (await logseq.Editor.getBlock(item.id)) {
      console.info(`📚 ${item.id} exists`);

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

    console.groupCollapsed("📚 syncing item", item.id);
    console.log("📚 syncing item", pageName);

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

    console.log("📚", pageName, "synced");

    console.groupEnd();
  }
};
