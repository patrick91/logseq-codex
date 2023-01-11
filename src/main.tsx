import "@logseq/libs";

import React from "react";
import * as ReactDOM from "react-dom/client";
import App from "./app";
import "./index.css";
import { format } from "date-fns";

import { logseq as PL } from "../package.json";

// @ts-expect-error
const css = (t, ...args) => String.raw(t, ...args);

const pluginId = PL.id;

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

async function formatDate(date: string) {
  return logseq.App.getUserConfigs().then((configs) => {
    return format(new Date(date), configs.preferredDateFormat);
  });
}

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

const sync = async () => {
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

function main() {
  console.info(`#${pluginId}: MAIN`);
  const root = ReactDOM.createRoot(document.getElementById("app")!);

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  logseq.Editor.registerSlashCommand("📖 sync", async () => {
    console.log("🔥 sync");
    await sync();
  });

  function createModel() {
    return {
      show() {
        logseq.showMainUI();
      },
    };
  }

  logseq.provideModel(createModel());
  logseq.setMainUIInlineStyle({
    zIndex: 11,
  });

  const openIconName = "template-plugin-open";

  logseq.provideStyle(css`
    .${openIconName} {
      opacity: 0.55;
      font-size: 20px;
      margin-top: 4px;
    }

    .${openIconName}:hover {
      opacity: 0.9;
    }
  `);

  logseq.App.registerUIItem("toolbar", {
    key: openIconName,
    template: `
      <div data-on-click="show" class="${openIconName}">⚙️</div>
    `,
  });
}

logseq.ready(main).catch(console.error);
