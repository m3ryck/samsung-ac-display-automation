# Apagar o visor do ar-condicionado Samsung

Instalador guiado e open source que cria uma **Rule na sua própria conta SmartThings**. Sempre que o ar-condicionado muda para ligado, a Rule aguarda cinco segundos (valor configurável) e envia somente:

```text
samsungce.airConditionerLighting.setLightingLevel("off")
```

Você executa o instalador uma vez. Depois disso, a automação permanece no SmartThings e funciona sem computador ligado, servidor, Alexa Skill, AWS, Home Assistant ou mensalidade deste projeto.

## O que esta v1 faz

- encontra automaticamente casas e aparelhos compatíveis;
- exige `switch` e `samsungce.airConditionerLighting` no componente `main`;
- valida que o aparelho aceita `on`, `off` e `setLightingLevel`;
- cria uma Rule acionada apenas na transição do ar para `on`;
- evita Rules duplicadas e permite consultar, atualizar ou remover a instalação;
- oferece um teste opcional que apenas observa o estado — o instalador nunca liga ou desliga o ar.

Ela não controla temperatura, modo, ventilação nem o estado ligado/desligado do aparelho.

## Requisitos

- ar-condicionado Samsung já adicionado e on-line no aplicativo SmartThings;
- a função de iluminação/visor disponível na tela do aparelho no SmartThings;
- Windows, macOS ou Linux com acesso a um navegador;
- [Node.js 24.8.0 ou mais recente](https://nodejs.org/en/download).

Não é necessário criar token, descobrir `deviceId`, configurar OAuth, editar `.env` ou possuir conta AWS.

## Instalação guiada

### Opção 1: usando Git

```bash
git clone https://github.com/m3ryck/skill-smartthings.git
cd skill-smartthings
npm install
npm run setup
```

### Opção 2: baixando um ZIP

1. Na página do projeto, escolha **Code → Download ZIP**.
2. Extraia o arquivo e abra um terminal dentro da pasta extraída.
3. Execute:

```bash
npm install
npm run setup
```

Na primeira consulta, a CLI oficial do SmartThings abre o navegador. Entre com a conta Samsung que possui o ar-condicionado e autorize o acesso. O assistente então:

1. seleciona automaticamente uma única casa e um único aparelho compatível, ou pede sua escolha;
2. mostra o aparelho, o estado atual e a ação exata;
3. permite escolher um atraso inteiro entre 0 e 60 segundos (padrão: 5);
4. pede confirmação antes de criar ou alterar qualquer Rule;
5. oferece um teste guiado de até 60 segundos.

Ao final, pode fechar o terminal e até remover esta pasta. **Não é preciso executar novamente a cada vez que ligar o ar.**

## Manutenção

Execute os comandos dentro da pasta do projeto:

```bash
npm run status
npm run update
npm run remove
```

- `status` lista apenas as Rules identificadas como criadas por este instalador;
- `update` revê ou altera o atraso do aparelho selecionado sem criar uma duplicata;
- `remove` pede confirmação e exclui a Rule selecionada ou todas as Rules deste projeto.

É possível fazer manutenção a partir de uma nova cópia do repositório. Nenhum estado é salvo na pasta do projeto: a identificação fica nos metadados da própria Rule.

Para também encerrar a sessão local da CLI oficial depois de remover a Rule:

```bash
npx smartthings logout
```

## Como funciona

A Rule criada equivale a:

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

`changes` evita repetir o comando enquanto o ar simplesmente permanece ligado. A documentação oficial confirma que Rules servem para automações “configure e esqueça”, que ações podem aguardar e executar comandos e que capabilities personalizadas podem ser usadas em Rules:

- [SmartThings Rules](https://developer.smartthings.com/docs/automations/rules)
- [SmartThings Custom Capabilities](https://developer.smartthings.com/docs/devices/capabilities/custom-capabilities)
- [SmartThings CLI oficial](https://github.com/SmartThingsCommunity/smartthings-cli)

Esta arquitetura é deliberadamente mais simples que uma Alexa Skill pública: não existe backend mantido pelo autor, custo por invocação ou banco de tokens de usuários. A desvantagem é a configuração inicial local com Node.js e terminal.

## Segurança e privacidade

- O projeto usa a CLI oficial `@smartthings/cli`, que realiza o login pelo navegador quando necessário.
- Este código não solicita, recebe, armazena ou imprime tokens SmartThings.
- Não há token global, `deviceId` fixo, telemetria ou servidor do projeto.
- A CLI é executada diretamente pelo Node, sem shell e com argumentos separados, inclusive no Windows.
- O JSON temporário da Rule usa permissão restrita e é apagado mesmo quando uma operação falha.
- Mensagens de erro têm campos comuns de token e autorização censurados.
- Toda alteração e remoção exige confirmação explícita.
- A dependência HTTP da CLI é resolvida para uma versão 1.x corrigida; o CI executa testes e auditoria de segurança.

A sessão de autenticação fica sob responsabilidade e no perfil local da própria CLI oficial. Use `npx smartthings logout` para desvinculá-la daquele computador.

## Solução de problemas

### O navegador não abriu ou o login expirou

Encerre a sessão e repita a configuração:

```bash
npx smartthings logout
npm run setup
```

Não cole um Personal Access Token no projeto. A documentação atual considera PAT apropriado para testes de curta duração e recomenda OAuth 2.0 para integrações duradouras; neste instalador, o fluxo de navegador pertence à CLI oficial. Consulte [Authorization and Permissions](https://developer.smartthings.com/docs/getting-started/authorization-and-permissions).

### Nenhum aparelho compatível foi encontrado

Confirme no aplicativo SmartThings que:

- o aparelho está on-line e na mesma conta usada no navegador;
- a tela do aparelho possui o controle de iluminação/visor;
- o perfil do dispositivo expõe `switch` e `samsungce.airConditionerLighting` em `main`.

O nome ou modelo do aparelho não é usado como critério principal.

### Erros 401 ou 403

A sessão pode ter expirado ou a autorização pode ter sido negada. Execute `npx smartthings logout` e tente outra vez, autorizando a conta correta.

### Erro 404

O aparelho ou a Rule pode ter sido removido ou recriado no SmartThings. Rode `npm run status`; se necessário, remova a configuração antiga e execute `npm run setup` novamente.

### Erro 429, timeout ou erro 5xx

A API do SmartThings pode estar limitando chamadas ou indisponível. Aguarde alguns minutos e repita. Uma falha no teste opcional não remove uma Rule que já tenha sido criada com sucesso.

## Teste manual de aceitação

Depois de `npm run setup`:

1. desligue o ar-condicionado e aguarde o SmartThings mostrar `off`;
2. ligue pelo aplicativo SmartThings;
3. confirme que o visor apaga após o atraso escolhido;
4. repita ligando pelo controle remoto físico;
5. se já controlar o ar pela Alexa, repita ligando por voz;
6. feche o instalador ou desligue o computador e repita o teste.

O resultado esperado é o mesmo em todos os casos porque a Rule reage ao estado informado pelo aparelho no SmartThings, não à origem do comando.

## Desenvolvimento

```bash
npm ci
npm test
npm run typecheck
npm run build
npm audit
```

Os testes não acessam uma conta real: usam gateways e terminais falsos. O teste ponta a ponta com um aparelho real é necessariamente manual para evitar qualquer alteração em contas durante o CI.

## Licença

[MIT](LICENSE)
