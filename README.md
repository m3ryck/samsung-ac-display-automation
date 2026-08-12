# Turn off the Samsung air conditioner display

**English** | [Português (Brasil)](README.pt-BR.md)

An open-source guided installer that creates a **Rule in your own SmartThings account**. Whenever the air conditioner changes to on, the Rule waits five seconds (a configurable value) and sends only:

```text
samsungce.airConditionerLighting.setLightingLevel("off")
```

You run the installer once. Afterwards, the automation remains in SmartThings and works without a computer left on, server, Alexa Skill, AWS, Home Assistant, or subscription for this project.

## What this v1 does

- automatically finds compatible locations and devices;
- requires `switch` and `samsungce.airConditionerLighting` on the `main` component;
- validates that the device accepts `on`, `off`, and `setLightingLevel`;
- creates a Rule triggered only when the air conditioner transitions to `on`;
- prevents duplicate Rules and lets you view, update, or remove the installation;
- offers an optional test that only observes state — the installer never turns the air conditioner on or off.

It does not control the device's temperature, mode, fan, or on/off state.

## Language

By default, the installer uses the system language: any Portuguese variant uses Brazilian Portuguese, English variants use English, and other languages fall back to English. To override that selection for any command, use `--lang en` or `--lang pt-BR`. Both of the following forms are accepted:

```bash
npm run setup -- --lang en
npm run status -- --lang=en
```

## Requirements

- a Samsung air conditioner already added and online in the SmartThings app;
- the lighting/display feature available on the device screen in SmartThings;
- Windows, macOS, or Linux with access to a browser;
- [Node.js 24.8.0 or later](https://nodejs.org/en/download).

You do not need to create a token, find a `deviceId`, configure OAuth, edit `.env`, or have an AWS account.

## Guided installation

### Option 1: using Git

```bash
git clone https://github.com/m3ryck/skill-smartthings.git
cd skill-smartthings
npm install
npm run setup
```

### Option 2: downloading a ZIP

1. On the project page, choose **Code → Download ZIP**.
2. Extract the file and open a terminal inside the extracted folder.
3. Run:

```bash
npm install
npm run setup
```

On the first request, the official SmartThings CLI opens the browser. Sign in with the Samsung account that owns the air conditioner and authorize access. The assistant then:

1. automatically selects a single location and compatible device, or asks you to choose;
2. displays the device, current state, and exact action;
3. lets you choose a whole-second delay between 0 and 60 seconds (default: 5);
4. asks for confirmation before creating or changing any Rule;
5. offers a guided test of up to 60 seconds.

When finished, you can close the terminal and even remove this folder. **You do not need to run it again every time you turn on the air conditioner.**

## Maintenance

Run the commands inside the project folder:

```bash
npm run status
npm run update
npm run remove
```

- `status` lists only the Rules identified as created by this installer;
- `update` reviews or changes the selected device's delay without creating a duplicate;
- `remove` asks for confirmation and deletes the selected Rule or every Rule from this project.

You can perform maintenance from a fresh copy of the repository. No state is saved in the project folder: identification is stored in the Rule's own metadata.

To also end the official CLI's local session after removing the Rule:

```bash
npx smartthings logout
```

## How it works

A created Rule is equivalent to:

```json
{
  "if": {
    "changes": {
      "id": "air-conditioner-turned-on",
      "equals": {
        "left": {
          "device": {
            "devices": ["ID ENCONTRADO AUTOMATICAMENTE"],
            "component": "main",
            "capability": "switch",
            "attribute": "switch",
            "trigger": "Always"
          }
        },
        "right": { "string": "on" }
      }
    },
    "then": [
      {
        "sleep": {
          "duration": { "value": { "integer": 5 }, "unit": "Second" }
        }
      },
      {
        "command": {
          "devices": ["ID ENCONTRADO AUTOMATICAMENTE"],
          "commands": [
            {
              "component": "main",
              "capability": "samsungce.airConditionerLighting",
              "command": "setLightingLevel",
              "arguments": [{ "string": "off" }]
            }
          ]
        }
      }
    ]
  }
}
```

`changes` prevents repeating the command while the air conditioner simply remains on. The official documentation confirms that Rules are for “set and forget” automations, actions can wait and execute commands, and custom capabilities can be used in Rules:

- [SmartThings Rules](https://developer.smartthings.com/docs/automations/rules)
- [SmartThings Custom Capabilities](https://developer.smartthings.com/docs/devices/capabilities/custom-capabilities)
- [Official SmartThings CLI](https://github.com/SmartThingsCommunity/smartthings-cli)

This architecture is deliberately simpler than a public Alexa Skill: there is no author-maintained backend, per-invocation cost, or user-token database. The tradeoff is the initial local setup with Node.js and a terminal.

## Security and privacy

- The project uses the official `@smartthings/cli`, which signs in through the browser when needed.
- This code does not request, receive, store, or print SmartThings tokens.
- There is no global token, fixed `deviceId`, telemetry, or project server.
- The CLI is run directly by Node, without a shell and with separate arguments, including on Windows.
- The Rule's temporary JSON has restricted permission and is deleted even when an operation fails.
- Error messages redact common token and authorization fields.
- Every change and removal requires explicit confirmation.
- The CLI's HTTP dependency is resolved to a fixed 1.x version; CI runs tests and a security audit.

The authentication session is managed by and stored in the official CLI's local profile. Use `npx smartthings logout` to unlink it from that computer.

## Troubleshooting

### The browser did not open or the login expired

End the session and repeat the setup:

```bash
npx smartthings logout
npm run setup
```

Do not paste a Personal Access Token into the project. Current documentation considers a PAT appropriate for short-lived tests and recommends OAuth 2.0 for long-lived integrations; in this installer, the browser flow belongs to the official CLI. See [Authorization and Permissions](https://developer.smartthings.com/docs/getting-started/authorization-and-permissions).

### No compatible device was found

Confirm in the SmartThings app that:

- the device is online and in the same account used in the browser;
- the device screen has the lighting/display control;
- the device profile exposes `switch` and `samsungce.airConditionerLighting` on `main`.

The device name or model is not used as the primary criterion.

### 401 or 403 errors

The session may have expired or authorization may have been denied. Run `npx smartthings logout` and try again, authorizing the correct account.

### 404 error

The device or Rule may have been removed or recreated in SmartThings. Run `npm run status`; if needed, remove the old configuration and run `npm run setup` again.

### 429, timeout, or 5xx error

The SmartThings API may be rate-limiting requests or unavailable. Wait a few minutes and try again. A failure in the optional test does not remove a Rule that was already created successfully.

## Manual acceptance test

After `npm run setup`:

1. turn off the air conditioner and wait for SmartThings to show `off`;
2. turn it on from the SmartThings app;
3. confirm that the display turns off after the selected delay;
4. repeat by turning it on with the physical remote control;
5. if you already control the air conditioner with Alexa, repeat by turning it on by voice;
6. close the installer or turn off the computer and repeat the test.

The expected result is the same in all cases because the Rule reacts to the state reported by the device in SmartThings, not to the command's origin.

## Development

```bash
npm ci
npm test
npm run typecheck
npm run build
npm audit
```

The tests do not access a real account: they use fake gateways and terminals. End-to-end testing with a real device must be manual to avoid changing accounts during CI.

## License

[MIT](LICENSE)
