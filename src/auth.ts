const startAuthorization = async () => {
  const params = new URLSearchParams();
  params.append("client_id", "patrick");
  params.append("grant_type", "urn:ietf:params:oauth:grant-type:device_code");

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
  params.append("client_id", "patrick");
  params.append("grant_type", "urn:ietf:params:oauth:grant-type:device_code");
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
  const authorization = await startAuthorization();

  // create a block saying "Please go to this URL and enter this code"
  // and then open the URL in a new tab
  //
  const text = `Please go to ${authorization.verificationUri} and enter the code ${authorization.userCode}`;

  await logseq.Editor.insertAtEditingCursor(text);
  const block = await logseq.Editor.getCurrentBlock();

  window.open(authorization.verificationUriComplete, "_blank");

  const interval = setInterval(async () => {
    const token = await fetchToken(authorization.deviceCode);

    if (token.error) {
      await logseq.Editor.updateBlock(
        block!.uuid,
        "Still waiting for you to authorize this app"
      );

      return;
    }

    if (token.access_token) {
      await logseq.Editor.updateBlock(
        block!.uuid,
        "You have successfully authorized this app 🔥"
      );
    }

    clearInterval(interval);
  }, authorization.interval * 1000);

  return;
};