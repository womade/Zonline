# Deploy Your Own

Deploy your own Waline project with Vercel.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/import-flow?s=https://github.com/womade/Zonline)

### How We Created This Example

```js
//index.js
const Waline = require('@womade/Zonline');
module.exports = Zonline();

//vercel.json
{
  "builds": [
    {
      "src": "index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "index.js"
    }
  ]
}
```

## Deploying From Your Terminal

You can deploy your new Waline project with a single command from your terminal using [Vercel CLI](https://vercel.com/download):

```shell
$ vercel
```
