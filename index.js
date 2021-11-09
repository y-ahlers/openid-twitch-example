import { Issuer, generators } from "openid-client";
import Fastify from "fastify";
import FastifyCookie from "fastify-cookie";
import dotenv from "dotenv";

dotenv.config();

const fastify = Fastify({
  logger: true,
});

fastify.register(FastifyCookie, {
  secret: "my-secret",
  parseOptions: {},
});

const issuer = await Issuer.discover("https://id.twitch.tv/oauth2");

const client = new issuer.Client({
  client_id: process.env.CLIENT_ID,
  client_secret: process.env.CLIENT_SECRET,
  redirect_uris: ["http://localhost:8055/auth/login/twitch/callback"],
  response_types: ["code"],
});

fastify.get("/", (_request, reply) => {
  const code_verifier = generators.codeVerifier();
  const code_challenge = generators.codeChallenge(code_verifier);

  const url = client.authorizationUrl({
    scope: "openid user:read:email",
    code_challenge,
    code_challenge_method: "S256",
    claims: {
      id_token: { email: null, email_verified: null },
    },
  });

  reply
    .setCookie("verifier", code_verifier, { signed: true, httpOnly: true })
    .type("text/html")
    .code(200);

  return `
    <a href="${url}">Login with Twitch</a>
  `;
});

fastify.get("/auth/login/twitch/callback", async (request, reply) => {
  const code_verifier = request.unsignCookie(request.cookies.verifier);

  const params = client.callbackParams(request);
  const tokenSet = await client.callback(
    "http://localhost:8055/auth/login/twitch/callback",
    params,
    { code_verifier }
  );

  const userinfo = await client.userinfo(tokenSet.access_token);

  reply.type("text/html").code(200);

  return `
  <h3>TokenSet</h3>
  <pre>
  ${JSON.stringify(tokenSet, null, 4)}
  </pre>
  <h3>Claims</h3>
  <pre>
  ${JSON.stringify(tokenSet.claims(), null, 4)}
  </pre>
  <h3>Userinfo</h3>
  <pre>
  ${JSON.stringify(userinfo, null, 4)}
  </pre>
  `;
});

fastify.listen(8055, (err, address) => {
  if (err) throw err;
  fastify.log.info(`Server is now listening on ${address}`);
});
