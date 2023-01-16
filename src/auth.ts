const CLIENT_ID = "logseq";
const GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";

export const getToken = (): {
  access_token: string;
  refresh_token: string;
} | null => {
  const token = window.localStorage.getItem("codex-token");

  if (!token) {
    return null;
  }

  return JSON.parse(token);
};

const setToken = (token: { access_token: string; refresh_token: string }) => {
  window.localStorage.setItem("codex-token", JSON.stringify(token));
};

const startAuthorization = async () => {
  const params = new URLSearchParams();
  params.append("client_id", CLIENT_ID);
  params.append("grant_type", GRANT_TYPE);

  const url = `http://localhost:8000/device_authorization?${params.toString()}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  }).then((res) => res.json());

  return {
    deviceCode: res.device_code,
    userCode: res.user_code,
    verificationUri: res.verification_uri,
    verificationUriComplete: res.verification_uri_complete,
    expiresIn: res.expires_in,
    interval: res.interval,
  };
};

const fetchToken = async (deviceCode: string) => {
  const params = new URLSearchParams();
  params.append("client_id", CLIENT_ID);
  params.append("grant_type", GRANT_TYPE);
  params.append("device_code", deviceCode);

  const url = `http://localhost:8000/token?${params.toString()}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  }).then((res) => res.json());

  return res;
};

export const login = async () => {
  const token = getToken();

  if (token) {
    await logseq.UI.showMsg("Already logged in");

    return;
  }

  await logseq.Editor.insertAtEditingCursor("📚 Connecting to the server...");
  const block = await logseq.Editor.getCurrentBlock();

  let authorization: Awaited<ReturnType<typeof startAuthorization>>;

  try {
    authorization = await startAuthorization();
  } catch (e) {
    await logseq.UI.showMsg(
      "Failed to contact the server, please try again later"
    );

    await logseq.Editor.removeBlock(block!.uuid);

    return;
  }

  const text = "📚 Waiting for authorization...";

  await logseq.Editor.updateBlock(block!.uuid, text);

  window.open(authorization.verificationUriComplete, "_blank");

  const interval = setInterval(async () => {
    const token = await fetchToken(authorization.deviceCode);

    if (token.error) {
      await logseq.Editor.updateBlock(
        block!.uuid,
        "📚 Still waiting for you to authorize this app"
      );

      return;
    }

    if (token.access_token) {
      await logseq.UI.showMsg("You have successfully authorized this app 🔥");

      await logseq.Editor.removeBlock(block!.uuid);

      setToken(token);
    }

    clearInterval(interval);
  }, authorization.interval * 1000);

  return;
};
