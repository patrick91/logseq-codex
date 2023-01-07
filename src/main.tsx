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
};

const getTextForItem = (item: Item) => {
  let text = `${item.title}\n`;

  if (item.thumbnailUrl && item.thumbnailUrl.length > 0) {
    text += `![${item.title}](${item.thumbnailUrl})\n`;
  }

  text += `codex-id:: ${item.id}\nurl:: ${item.sourceUrl}\n`;

  return text + "\n";
};

async function getCurrentDate() {
  return logseq.App.getUserConfigs().then((configs) => {
    return format(new Date(), configs.preferredDateFormat);
  });
}

async function formatDate(date: string) {
  return logseq.App.getUserConfigs().then((configs) => {
    return format(new Date(date), configs.preferredDateFormat);
  });
}

const sync = async () => {
  const res = await fetch("http://localhost:8000/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: ` {myItems { id title sourceUrl createdAt thumbnailUrl }}`,
    }),
  }).then((res) => res.json());

  console.log(res.data.myItems);

  const itemsToSync = res.data.myItems;

  itemsToSync.forEach(async (item: Item) => {
    logseq.Editor.appendBlockInPage(
      await formatDate(item.createdAt),
      getTextForItem(item)
    );
  });
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
    sync();
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
