var _a;
import { jsx, jsxs } from "react/jsx-runtime";
import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { ServerRouter, UNSAFE_withComponentProps, Meta, Links, Outlet, ScrollRestoration, Scripts, useLoaderData, useActionData, Form, redirect, UNSAFE_withErrorBoundaryProps, useRouteError, useFetcher, useRevalidator } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { isbot } from "isbot";
import "@shopify/shopify-app-react-router/adapters/node";
import { shopifyApp, AppDistribution, ApiVersion, LoginErrorType, boundary } from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { PrismaClient } from "@prisma/client";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useState, useEffect } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}
const prisma = global.prismaGlobal ?? new PrismaClient();
const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.July26,
  scopes: (_a = process.env.SCOPES) == null ? void 0 : _a.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.SingleMerchant,
  future: {
    expiringOfflineAccessTokens: true
  },
  ...process.env.SHOP_CUSTOM_DOMAIN ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] } : {}
});
ApiVersion.July26;
const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
const authenticate = shopify.authenticate;
shopify.unauthenticated;
const login = shopify.login;
shopify.registerWebhooks;
shopify.sessionStorage;
const streamTimeout = 5e3;
async function handleRequest(request, responseStatusCode, responseHeaders, reactRouterContext) {
  addDocumentResponseHeaders(request, responseHeaders);
  const userAgent = request.headers.get("user-agent");
  const callbackName = isbot(userAgent ?? "") ? "onAllReady" : "onShellReady";
  return new Promise((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(
      /* @__PURE__ */ jsx(ServerRouter, { context: reactRouterContext, url: request.url }),
      {
        [callbackName]: () => {
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode
            })
          );
          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          console.error(error);
        }
      }
    );
    setTimeout(abort, streamTimeout + 1e3);
  });
}
const entryServer = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: handleRequest,
  streamTimeout
}, Symbol.toStringTag, { value: "Module" }));
const root = UNSAFE_withComponentProps(function App() {
  return /* @__PURE__ */ jsxs("html", {
    lang: "en",
    children: [/* @__PURE__ */ jsxs("head", {
      children: [/* @__PURE__ */ jsx("meta", {
        charSet: "utf-8"
      }), /* @__PURE__ */ jsx("meta", {
        name: "viewport",
        content: "width=device-width,initial-scale=1"
      }), /* @__PURE__ */ jsx("link", {
        rel: "preconnect",
        href: "https://cdn.shopify.com/"
      }), /* @__PURE__ */ jsx("link", {
        rel: "stylesheet",
        href: "https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
      }), /* @__PURE__ */ jsx(Meta, {}), /* @__PURE__ */ jsx(Links, {})]
    }), /* @__PURE__ */ jsxs("body", {
      children: [/* @__PURE__ */ jsx(Outlet, {}), /* @__PURE__ */ jsx(ScrollRestoration, {}), /* @__PURE__ */ jsx(Scripts, {})]
    })]
  });
});
const route0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: root
}, Symbol.toStringTag, { value: "Module" }));
const action$3 = async ({
  request
}) => {
  const {
    payload,
    session,
    topic,
    shop
  } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);
  const current = payload.current;
  if (session) {
    await prisma.session.update({
      where: {
        id: session.id
      },
      data: {
        scope: current.toString()
      }
    });
  }
  return new Response();
};
const route1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$3
}, Symbol.toStringTag, { value: "Module" }));
const action$2 = async ({
  request
}) => {
  const {
    shop,
    session,
    topic
  } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);
  if (session) {
    await prisma.session.deleteMany({
      where: {
        shop
      }
    });
  }
  return new Response();
};
const route2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$2
}, Symbol.toStringTag, { value: "Module" }));
function loginErrorMessage(loginErrors) {
  if ((loginErrors == null ? void 0 : loginErrors.shop) === LoginErrorType.MissingShop) {
    return { shop: "Please enter your shop domain to log in" };
  } else if ((loginErrors == null ? void 0 : loginErrors.shop) === LoginErrorType.InvalidShop) {
    return { shop: "Please enter a valid shop domain to log in" };
  }
  return {};
}
const loader$4 = async ({
  request
}) => {
  const errors = loginErrorMessage(await login(request));
  return {
    errors
  };
};
const action$1 = async ({
  request
}) => {
  const errors = loginErrorMessage(await login(request));
  return {
    errors
  };
};
const route$1 = UNSAFE_withComponentProps(function Auth() {
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const [shop, setShop] = useState("");
  const {
    errors
  } = actionData || loaderData;
  return /* @__PURE__ */ jsx(AppProvider, {
    embedded: false,
    children: /* @__PURE__ */ jsx("s-page", {
      children: /* @__PURE__ */ jsx(Form, {
        method: "post",
        children: /* @__PURE__ */ jsxs("s-section", {
          heading: "Log in",
          children: [/* @__PURE__ */ jsx("s-text-field", {
            name: "shop",
            label: "Shop domain",
            details: "example.myshopify.com",
            value: shop,
            onChange: (e) => setShop(e.currentTarget.value),
            autocomplete: "on",
            error: errors.shop
          }), /* @__PURE__ */ jsx("s-button", {
            type: "submit",
            children: "Log in"
          })]
        })
      })
    })
  });
});
const route3 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$1,
  default: route$1,
  loader: loader$4
}, Symbol.toStringTag, { value: "Module" }));
const loader$3 = async ({
  request
}) => {
  await authenticate.admin(request);
  return null;
};
const headers$2 = (headersArgs) => {
  return boundary.headers(headersArgs);
};
const route4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  headers: headers$2,
  loader: loader$3
}, Symbol.toStringTag, { value: "Module" }));
const index = "_index_1hqgz_1";
const heading = "_heading_1hqgz_21";
const text = "_text_1hqgz_23";
const content = "_content_1hqgz_43";
const form = "_form_1hqgz_53";
const label = "_label_1hqgz_69";
const input = "_input_1hqgz_85";
const button = "_button_1hqgz_93";
const list = "_list_1hqgz_101";
const styles = {
  index,
  heading,
  text,
  content,
  form,
  label,
  input,
  button,
  list
};
const loader$2 = async ({
  request
}) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  return {
    showForm: Boolean(login)
  };
};
const route = UNSAFE_withComponentProps(function App2() {
  const {
    showForm
  } = useLoaderData();
  return /* @__PURE__ */ jsx("div", {
    className: styles.index,
    children: /* @__PURE__ */ jsxs("div", {
      className: styles.content,
      children: [/* @__PURE__ */ jsx("h1", {
        className: styles.heading,
        children: "A short heading about [your app]"
      }), /* @__PURE__ */ jsx("p", {
        className: styles.text,
        children: "A tagline about [your app] that describes your value proposition."
      }), showForm && /* @__PURE__ */ jsxs(Form, {
        className: styles.form,
        method: "post",
        action: "/auth/login",
        children: [/* @__PURE__ */ jsxs("label", {
          className: styles.label,
          children: [/* @__PURE__ */ jsx("span", {
            children: "Shop domain"
          }), /* @__PURE__ */ jsx("input", {
            className: styles.input,
            type: "text",
            name: "shop"
          }), /* @__PURE__ */ jsx("span", {
            children: "e.g: my-shop-domain.myshopify.com"
          })]
        }), /* @__PURE__ */ jsx("button", {
          className: styles.button,
          type: "submit",
          children: "Log in"
        })]
      }), /* @__PURE__ */ jsxs("ul", {
        className: styles.list,
        children: [/* @__PURE__ */ jsxs("li", {
          children: [/* @__PURE__ */ jsx("strong", {
            children: "Product feature"
          }), ". Some detail about your feature and its benefit to your customer."]
        }), /* @__PURE__ */ jsxs("li", {
          children: [/* @__PURE__ */ jsx("strong", {
            children: "Product feature"
          }), ". Some detail about your feature and its benefit to your customer."]
        }), /* @__PURE__ */ jsxs("li", {
          children: [/* @__PURE__ */ jsx("strong", {
            children: "Product feature"
          }), ". Some detail about your feature and its benefit to your customer."]
        })]
      })]
    })
  });
});
const route5 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: route,
  loader: loader$2
}, Symbol.toStringTag, { value: "Module" }));
const loader$1 = async ({
  request
}) => {
  await authenticate.admin(request);
  return {
    apiKey: process.env.SHOPIFY_API_KEY || ""
  };
};
const app = UNSAFE_withComponentProps(function App3() {
  const {
    apiKey
  } = useLoaderData();
  return /* @__PURE__ */ jsxs(AppProvider, {
    embedded: true,
    apiKey,
    children: [/* @__PURE__ */ jsxs("s-app-nav", {
      children: [/* @__PURE__ */ jsx("s-link", {
        href: "/app",
        children: "Home"
      }), /* @__PURE__ */ jsx("s-link", {
        href: "/app/additional",
        children: "Additional page"
      })]
    }), /* @__PURE__ */ jsx(Outlet, {})]
  });
});
const ErrorBoundary = UNSAFE_withErrorBoundaryProps(function ErrorBoundary2() {
  return boundary.error(useRouteError());
});
const headers$1 = (headersArgs) => {
  return boundary.headers(headersArgs);
};
const route6 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ErrorBoundary,
  default: app,
  headers: headers$1,
  loader: loader$1
}, Symbol.toStringTag, { value: "Module" }));
const app_additional = UNSAFE_withComponentProps(function AdditionalPage() {
  return /* @__PURE__ */ jsxs("s-page", {
    heading: "Additional page",
    children: [/* @__PURE__ */ jsxs("s-section", {
      heading: "Multiple pages",
      children: [/* @__PURE__ */ jsxs("s-paragraph", {
        children: ["The app template comes with an additional page which demonstrates how to create multiple pages within app navigation using", " ", /* @__PURE__ */ jsx("s-link", {
          href: "https://shopify.dev/docs/apps/tools/app-bridge",
          target: "_blank",
          children: "App Bridge"
        }), "."]
      }), /* @__PURE__ */ jsxs("s-paragraph", {
        children: ["To create your own page and have it show up in the app navigation, add a page inside ", /* @__PURE__ */ jsx("code", {
          children: "app/routes"
        }), ", and a link to it in the", " ", /* @__PURE__ */ jsx("code", {
          children: "<ui-nav-menu>"
        }), " component found in", " ", /* @__PURE__ */ jsx("code", {
          children: "app/routes/app.jsx"
        }), "."]
      })]
    }), /* @__PURE__ */ jsx("s-section", {
      slot: "aside",
      heading: "Resources",
      children: /* @__PURE__ */ jsx("s-unordered-list", {
        children: /* @__PURE__ */ jsx("s-list-item", {
          children: /* @__PURE__ */ jsx("s-link", {
            href: "https://shopify.dev/docs/apps/design-guidelines/navigation#app-nav",
            target: "_blank",
            children: "App nav best practices"
          })
        })
      })
    })]
  });
});
const route7 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: app_additional
}, Symbol.toStringTag, { value: "Module" }));
const translations = new Map(Object.entries({
  pressure: "presión",
  cleaner: "hidrolavadora",
  washer: "lavadora",
  induction: "inducción",
  silicone: "silicona",
  children: "infantil",
  child: "infantil",
  tabletop: "mesa",
  microscope: "microscopio",
  digital: "digital",
  industrial: "industrial",
  camera: "cámara",
  card: "tarjeta",
  review: "reseñas",
  google: "Google",
  black: "negro",
  white: "blanco",
  premium: "",
  wear: "",
  resistant: "resistente",
  finish: "acabado",
  reusable: "reutilizable",
  tap: "contacto",
  nfc: "NFC",
  tool: "herramienta",
  tools: "herramientas",
  motorcycle: "moto",
  repair: "reparación",
  box: "maletín",
  heavy: "reforzado",
  duty: "",
  set: "kit",
  kit: "kit",
  wrench: "llave",
  socket: "dados",
  bra: "brasier",
  push: "push",
  up: "up",
  front: "frontal",
  closure: "cierre",
  seamless: "sin costuras",
  lingerie: "lencería",
  car: "auto",
  plug: "tapón",
  patch: "parche",
  gum: "neumático",
  height: "alto",
  custom: "personalizado",
  made: "",
  curtain: "cortina",
  curtains: "cortinas",
  blackout: "opaca",
  smartwatch: "reloj inteligente",
  smart: "inteligente",
  watch: "reloj",
  blood: "oxígeno",
  oxygen: "sanguíneo",
  inch: "pulgadas",
  ultra: "ultra",
  thin: "delgado",
  digitalcamera: "cámara digital",
  phone: "teléfono",
  stand: "soporte",
  mobile: "móvil",
  childrens: "infantil",
  korea: "Corea",
  japan: "Japón",
  south: "del Sur",
  clock: "reloj",
  salvador: "Salvador",
  dali: "Dalí",
  youth: "juvenil",
  edition: "edición",
  electric: "eléctrico",
  insulated: "aislado",
  screwdriver: "destornillador",
  screwdrivers: "destornilladores",
  magnetic: "magnético",
  professional: "profesional",
  wood: "madera",
  garden: "jardín",
  wireless: "inalámbrico",
  portable: "portátil",
  projector: "proyector",
  speaker: "altavoz",
  hair: "cabello",
  dryer: "secador",
  kitchen: "cocina",
  storage: "almacenamiento",
  organizer: "organizador",
  led: "LED",
  lamp: "lámpara",
  light: "luz",
  toy: "juguete",
  pet: "mascota",
  water: "agua",
  bottle: "botella",
  bag: "bolso",
  case: "estuche",
  holder: "soporte",
  vacuum: "aspiradora",
  "4k": "4K",
  "1080p": "Full HD",
  "100v": "100 V",
  "1000v": "1000 V"
}));
function suggestSpanishTitle(title = "", vendor = "") {
  let parts = title.replace(/\b\d+(?:\.\d+)?\s*(?:pcs?|pieces?|set|inch|inches|cm|mm|bar)\b/gi, (m) => m.trim()).replace(/[|•·]/g, " ").replace(/\s+/g, " ").trim().split(" ");
  const vendorKey = vendor.trim().toLocaleLowerCase("es");
  if (vendorKey) parts = parts.filter((word) => word.toLocaleLowerCase("es") !== vendorKey);
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const part of parts) {
    const key = part.toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]/gu, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const translated = translations.get(key) ?? part;
    if (!translated) continue;
    for (const word of translated.split(" ")) {
      if (result.length >= 6) break;
      result.push(word);
    }
    if (result.length >= 6) break;
  }
  const value = result.join(" ").replace(/\s+/g, " ").trim();
  return value ? value[0].toLocaleUpperCase("es") + value.slice(1) : title.slice(0, 56);
}
async function syncProductTitles(prisma2, shop, products) {
  if (!products.length) return /* @__PURE__ */ new Map();
  const current = await prisma2.productTitle.findMany({
    where: { shop, productGid: { in: products.map((p) => p.id) } }
  });
  const byId = new Map(current.map((row) => [row.productGid, row]));
  await prisma2.$transaction(products.map((product) => {
    const existing = byId.get(product.id);
    const changedTitle = existing && existing.sourceTitle !== product.title;
    return prisma2.productTitle.upsert({
      where: { shop_productGid: { shop, productGid: product.id } },
      create: {
        shop,
        productGid: product.id,
        handle: product.handle,
        sourceTitle: product.title,
        spanishTitle: suggestSpanishTitle(product.title, product.vendor)
      },
      update: {
        handle: product.handle,
        sourceTitle: product.title,
        ...changedTitle ? { spanishTitle: suggestSpanishTitle(product.title, product.vendor) } : {}
      }
    });
  }));
  const rows = await prisma2.productTitle.findMany({
    where: { shop, productGid: { in: products.map((p) => p.id) } }
  });
  return new Map(rows.map((row) => [row.productGid, row]));
}
const PRODUCT_SEARCH = `#graphql
  query SearchProducts($first: Int!, $after: String, $query: String) {
      products(first: $first, after: $after, query: $query, sortKey: TITLE) {
      nodes {
        id title handle vendor status totalInventory
        spanishTitle: metafield(namespace: "custom", key: "nombre_breve_es") { value }
        variants(first: 1) { nodes { price } }
      }
      pageInfo { hasNextPage endCursor }
    }
    shop { currencyCode }
  }
`;
const SAVE_DISPLAY_TITLES = `#graphql
  mutation SaveSpanishProductNames($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id }
      userErrors { field message }
    }
  }
`;
async function publishDisplayTitles(admin, products, savedTitles) {
  var _a2, _b;
  const pending = products.filter((product) => {
    var _a3, _b2;
    const title = (_a3 = savedTitles.get(product.id)) == null ? void 0 : _a3.spanishTitle;
    return title && title !== ((_b2 = product.spanishTitle) == null ? void 0 : _b2.value);
  });
  for (let index2 = 0; index2 < pending.length; index2 += 25) {
    const metafields = pending.slice(index2, index2 + 25).map((product) => ({
      ownerId: product.id,
      namespace: "custom",
      key: "nombre_breve_es",
      type: "single_line_text_field",
      value: savedTitles.get(product.id).spanishTitle
    }));
    const response = await admin.graphql(SAVE_DISPLAY_TITLES, {
      variables: {
        metafields
      }
    });
    const result = await response.json();
    const errors = ((_b = (_a2 = result.data) == null ? void 0 : _a2.metafieldsSet) == null ? void 0 : _b.userErrors) ?? result.errors ?? [];
    if (errors.length) console.error("No se pudieron publicar algunos nombres breves:", errors);
  }
}
const normalizeProductText = (value = "") => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[^a-z0-9]+/g, " ").trim();
const loader = async ({
  request
}) => {
  var _a2, _b;
  const {
    admin,
    session
  } = await authenticate.admin(request);
  const search = ((_a2 = new URL(request.url).searchParams.get("q")) == null ? void 0 : _a2.trim()) ?? "";
  const normalizedSearch = normalizeProductText(search);
  const terms = [...new Set(normalizedSearch.split(" ").filter(Boolean))];
  const shopifyQuery = terms.length ? terms.map((term) => `title:${term}*`).join(" OR ") : void 0;
  let after = null;
  let hasNextPage = true;
  const products = [];
  let currencyCode = "COP";
  do {
    const response = await admin.graphql(PRODUCT_SEARCH, {
      variables: {
        first: 250,
        after,
        query: shopifyQuery
      }
    });
    const data = await response.json();
    if ((_b = data.errors) == null ? void 0 : _b.length) throw new Error("No se pudieron consultar los productos de Shopify.");
    const connection = data.data.products;
    currencyCode = data.data.shop.currencyCode;
    products.push(...connection.nodes);
    hasNextPage = Boolean(connection.pageInfo.hasNextPage);
    after = connection.pageInfo.endCursor;
  } while (hasNextPage);
  const savedTitles = await syncProductTitles(prisma, session.shop, products);
  try {
    await publishDisplayTitles(admin, products, savedTitles);
  } catch (error) {
    console.error("No se pudieron sincronizar los nombres breves con el tema:", error);
  }
  const rankedProducts = products.map((product) => {
    var _a3;
    const title = normalizeProductText(product.title);
    const compactTitle = title.replace(/\s/g, "");
    const compactSearch = normalizedSearch.replace(/\s/g, "");
    const allTermsMatch = terms.every((term) => title.includes(term));
    let rank = 99;
    if (!terms.length) rank = 0;
    else if (compactTitle === compactSearch) rank = 0;
    else if (compactTitle.startsWith(compactSearch)) rank = 1;
    else if (compactTitle.includes(compactSearch) || allTermsMatch) rank = 2;
    return {
      ...product,
      displayTitle: ((_a3 = savedTitles.get(product.id)) == null ? void 0 : _a3.spanishTitle) ?? suggestSpanishTitle(product.title, product.vendor),
      _rank: rank
    };
  }).filter((product) => product._rank < 99).sort((a, b) => a._rank - b._rank || a.displayTitle.localeCompare(b.displayTitle, "es"));
  return {
    products: rankedProducts,
    search,
    currencyCode
  };
};
const action = async ({
  request
}) => {
  var _a2, _b;
  const {
    admin,
    session
  } = await authenticate.admin(request);
  const formData = await request.formData();
  if (formData.get("intent") === "save-spanish-title") {
    const productGid = String(formData.get("productGid") ?? "");
    const spanishTitle = String(formData.get("spanishTitle") ?? "").trim();
    if (!productGid.startsWith("gid://shopify/Product/") || !spanishTitle || spanishTitle.length > 80) {
      return {
        error: "Escribe un nombre en español de hasta 80 caracteres."
      };
    }
    const metafieldResponse = await admin.graphql(SAVE_DISPLAY_TITLES, {
      variables: {
        metafields: [{
          ownerId: productGid,
          namespace: "custom",
          key: "nombre_breve_es",
          type: "single_line_text_field",
          value: spanishTitle
        }]
      }
    });
    const metafieldResult = await metafieldResponse.json();
    const metafieldErrors = ((_b = (_a2 = metafieldResult.data) == null ? void 0 : _a2.metafieldsSet) == null ? void 0 : _b.userErrors) ?? metafieldResult.errors ?? [];
    if (metafieldErrors.length) return {
      error: "No se pudo actualizar el nombre visible en la tienda."
    };
    await prisma.productTitle.updateMany({
      where: {
        shop: session.shop,
        productGid
      },
      data: {
        spanishTitle
      }
    });
    return {
      saved: true
    };
  }
  const color = ["Red", "Orange", "Yellow", "Green"][Math.floor(Math.random() * 4)];
  const response = await admin.graphql(`#graphql
      mutation populateProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
            demoInfo: metafield(namespace: "$app", key: "demo_info") {
              jsonValue
            }
          }
        }
      }`, {
    variables: {
      product: {
        title: `${color} Snowboard`,
        metafields: [{
          namespace: "$app",
          key: "demo_info",
          value: "Created by React Router Template"
        }]
      }
    }
  });
  const responseJson = await response.json();
  const product = responseJson.data.productCreate.product;
  const variantId = product.variants.edges[0].node.id;
  const variantResponse = await admin.graphql(`#graphql
    mutation shopifyReactRouterTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`, {
    variables: {
      productId: product.id,
      variants: [{
        id: variantId,
        price: "100.00"
      }]
    }
  });
  const variantResponseJson = await variantResponse.json();
  const metaobjectResponse = await admin.graphql(`#graphql
    mutation shopifyReactRouterTemplateUpsertMetaobject($handle: MetaobjectHandleInput!, $values: JSON!) {
      metaobjectUpsert(handle: $handle, values: $values) {
        metaobject {
          id
          handle
          values
        }
        userErrors {
          field
          message
        }
      }
    }`, {
    variables: {
      handle: {
        type: "$app:example",
        handle: "demo-entry"
      },
      values: {
        title: "Demo Entry",
        description: "This metaobject was created by the Shopify app template to demonstrate the metaobject API."
      }
    }
  });
  const metaobjectResponseJson = await metaobjectResponse.json();
  return {
    product: responseJson.data.productCreate.product,
    variant: variantResponseJson.data.productVariantsBulkUpdate.productVariants,
    metaobject: metaobjectResponseJson.data.metaobjectUpsert.metaobject
  };
};
const app__index = UNSAFE_withComponentProps(function Index() {
  var _a2, _b, _c, _d;
  const {
    products,
    search,
    currencyCode
  } = useLoaderData();
  const fetcher = useFetcher();
  const {
    revalidate
  } = useRevalidator();
  const shopify2 = useAppBridge();
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") revalidate();
    }, 6e4);
    return () => window.clearInterval(timer);
  }, [revalidate]);
  const isLoading = ["loading", "submitting"].includes(fetcher.state) && fetcher.formMethod === "POST";
  useEffect(() => {
    var _a3, _b2;
    if ((_b2 = (_a3 = fetcher.data) == null ? void 0 : _a3.product) == null ? void 0 : _b2.id) {
      shopify2.toast.show("Product created");
    }
  }, [(_b = (_a2 = fetcher.data) == null ? void 0 : _a2.product) == null ? void 0 : _b.id, shopify2]);
  const generateProduct = () => fetcher.submit({}, {
    method: "POST"
  });
  return /* @__PURE__ */ jsxs("s-page", {
    heading: "Gestor de productos",
    children: [/* @__PURE__ */ jsx("s-button", {
      slot: "primary-action",
      onClick: generateProduct,
      children: "Generate a product"
    }), /* @__PURE__ */ jsx("s-section", {
      heading: "Congrats on creating a new Shopify app 🎉",
      children: /* @__PURE__ */ jsxs("s-paragraph", {
        children: ["This embedded app template uses", " ", /* @__PURE__ */ jsx("s-link", {
          href: "https://shopify.dev/docs/apps/tools/app-bridge",
          target: "_blank",
          children: "App Bridge"
        }), " ", "interface examples like an", " ", /* @__PURE__ */ jsx("s-link", {
          href: "/app/additional",
          children: "additional page in the app nav"
        }), ", as well as an", " ", /* @__PURE__ */ jsx("s-link", {
          href: "https://shopify.dev/docs/api/admin-graphql",
          target: "_blank",
          children: "Admin GraphQL"
        }), " ", "mutation demo, to provide a starting point for app development."]
      })
    }), /* @__PURE__ */ jsxs("s-section", {
      heading: "Productos",
      children: [/* @__PURE__ */ jsx("s-paragraph", {
        children: "Busca por nombre; se ignoran mayúsculas, tildes y signos. Los títulos originales de Shopify se conservan y aquí se muestran de forma breve."
      }), /* @__PURE__ */ jsxs("form", {
        method: "get",
        style: {
          display: "flex",
          gap: "0.75rem",
          alignItems: "end",
          marginBottom: "1rem"
        },
        children: [/* @__PURE__ */ jsx("s-text-field", {
          label: "Buscar productos",
          name: "q",
          value: search,
          placeholder: "Ej.: camisa azul"
        }), /* @__PURE__ */ jsx("s-button", {
          type: "submit",
          variant: "primary",
          children: "Buscar"
        }), search && /* @__PURE__ */ jsx("s-button", {
          href: "/app",
          children: "Limpiar"
        })]
      }), /* @__PURE__ */ jsxs("s-paragraph", {
        children: [products.length, " ", products.length === 1 ? "producto" : "productos", search ? ` para “${search}”` : " recientes"]
      }), products.length ? /* @__PURE__ */ jsxs("s-table", {
        children: [/* @__PURE__ */ jsxs("s-table-header-row", {
          children: [/* @__PURE__ */ jsx("s-table-header", {
            children: "Producto"
          }), /* @__PURE__ */ jsx("s-table-header", {
            children: "Precio desde"
          }), /* @__PURE__ */ jsx("s-table-header", {
            children: "Inventario"
          })]
        }), /* @__PURE__ */ jsx("s-table-body", {
          children: products.map((product) => {
            var _a3;
            return /* @__PURE__ */ jsxs("s-table-row", {
              children: [/* @__PURE__ */ jsxs("s-table-cell", {
                children: [/* @__PURE__ */ jsx("strong", {
                  title: `Título original: ${product.title}`,
                  children: product.displayTitle
                }), /* @__PURE__ */ jsx("br", {}), /* @__PURE__ */ jsx("small", {
                  children: product.vendor || product.handle
                }), /* @__PURE__ */ jsxs("form", {
                  method: "post",
                  style: {
                    display: "flex",
                    gap: "0.4rem",
                    marginTop: "0.5rem"
                  },
                  children: [/* @__PURE__ */ jsx("input", {
                    type: "hidden",
                    name: "intent",
                    value: "save-spanish-title"
                  }), /* @__PURE__ */ jsx("input", {
                    type: "hidden",
                    name: "productGid",
                    value: product.id
                  }), /* @__PURE__ */ jsx("input", {
                    name: "spanishTitle",
                    defaultValue: product.displayTitle,
                    "aria-label": `Nombre en español de ${product.displayTitle}`,
                    maxLength: 80,
                    style: {
                      minWidth: 0,
                      width: "14rem"
                    }
                  }), /* @__PURE__ */ jsx("button", {
                    type: "submit",
                    children: "Guardar"
                  })]
                })]
              }), /* @__PURE__ */ jsx("s-table-cell", {
                children: ((_a3 = product.variants.nodes[0]) == null ? void 0 : _a3.price) != null ? new Intl.NumberFormat("es-CO", {
                  style: "currency",
                  currency: currencyCode
                }).format(Number(product.variants.nodes[0].price)) : "—"
              }), /* @__PURE__ */ jsx("s-table-cell", {
                children: product.totalInventory ?? "—"
              })]
            }, product.id);
          })
        })]
      }) : /* @__PURE__ */ jsx("s-paragraph", {
        children: "No se encontraron productos con ese nombre."
      })]
    }), /* @__PURE__ */ jsxs("s-section", {
      heading: "Get started with products",
      children: [/* @__PURE__ */ jsxs("s-paragraph", {
        children: ["Generate a product with GraphQL and get the JSON output for that product. Learn more about the", " ", /* @__PURE__ */ jsx("s-link", {
          href: "https://shopify.dev/docs/api/admin-graphql/latest/mutations/productCreate",
          target: "_blank",
          children: "productCreate"
        }), " ", "mutation in our API references. Includes a product", " ", /* @__PURE__ */ jsx("s-link", {
          href: "https://shopify.dev/docs/apps/build/custom-data/metafields",
          target: "_blank",
          children: "metafield"
        }), " ", "and", " ", /* @__PURE__ */ jsx("s-link", {
          href: "https://shopify.dev/docs/apps/build/custom-data/metaobjects",
          target: "_blank",
          children: "metaobject"
        }), "."]
      }), /* @__PURE__ */ jsxs("s-stack", {
        direction: "inline",
        gap: "base",
        children: [/* @__PURE__ */ jsx("s-button", {
          onClick: generateProduct,
          ...isLoading ? {
            loading: true
          } : {},
          children: "Generate a product"
        }), ((_c = fetcher.data) == null ? void 0 : _c.product) && /* @__PURE__ */ jsx("s-button", {
          onClick: () => {
            var _a3, _b2, _c2, _d2;
            (_d2 = (_c2 = shopify2.intents).invoke) == null ? void 0 : _d2.call(_c2, "edit:shopify/Product", {
              value: (_b2 = (_a3 = fetcher.data) == null ? void 0 : _a3.product) == null ? void 0 : _b2.id
            });
          },
          target: "_blank",
          variant: "tertiary",
          children: "Edit product"
        })]
      }), ((_d = fetcher.data) == null ? void 0 : _d.product) && /* @__PURE__ */ jsx("s-section", {
        heading: "productCreate mutation",
        children: /* @__PURE__ */ jsxs("s-stack", {
          direction: "block",
          gap: "base",
          children: [/* @__PURE__ */ jsx("s-box", {
            padding: "base",
            borderWidth: "base",
            borderRadius: "base",
            background: "subdued",
            children: /* @__PURE__ */ jsx("pre", {
              style: {
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word"
              },
              children: /* @__PURE__ */ jsx("code", {
                children: JSON.stringify(fetcher.data.product, null, 2)
              })
            })
          }), /* @__PURE__ */ jsx("s-heading", {
            children: "productVariantsBulkUpdate mutation"
          }), /* @__PURE__ */ jsx("s-box", {
            padding: "base",
            borderWidth: "base",
            borderRadius: "base",
            background: "subdued",
            children: /* @__PURE__ */ jsx("pre", {
              style: {
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word"
              },
              children: /* @__PURE__ */ jsx("code", {
                children: JSON.stringify(fetcher.data.variant, null, 2)
              })
            })
          }), /* @__PURE__ */ jsx("s-heading", {
            children: "metaobjectUpsert mutation"
          }), /* @__PURE__ */ jsx("s-box", {
            padding: "base",
            borderWidth: "base",
            borderRadius: "base",
            background: "subdued",
            children: /* @__PURE__ */ jsx("pre", {
              style: {
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word"
              },
              children: /* @__PURE__ */ jsx("code", {
                children: JSON.stringify(fetcher.data.metaobject, null, 2)
              })
            })
          })]
        })
      })]
    }), /* @__PURE__ */ jsxs("s-section", {
      slot: "aside",
      heading: "App template specs",
      children: [/* @__PURE__ */ jsxs("s-paragraph", {
        children: [/* @__PURE__ */ jsx("s-text", {
          children: "Framework: "
        }), /* @__PURE__ */ jsx("s-link", {
          href: "https://reactrouter.com/",
          target: "_blank",
          children: "React Router"
        })]
      }), /* @__PURE__ */ jsxs("s-paragraph", {
        children: [/* @__PURE__ */ jsx("s-text", {
          children: "Interface: "
        }), /* @__PURE__ */ jsx("s-link", {
          href: "https://shopify.dev/docs/api/app-home/using-polaris-components",
          target: "_blank",
          children: "Polaris web components"
        })]
      }), /* @__PURE__ */ jsxs("s-paragraph", {
        children: [/* @__PURE__ */ jsx("s-text", {
          children: "API: "
        }), /* @__PURE__ */ jsx("s-link", {
          href: "https://shopify.dev/docs/api/admin-graphql",
          target: "_blank",
          children: "GraphQL"
        })]
      }), /* @__PURE__ */ jsxs("s-paragraph", {
        children: [/* @__PURE__ */ jsx("s-text", {
          children: "Custom data: "
        }), /* @__PURE__ */ jsx("s-link", {
          href: "https://shopify.dev/docs/apps/build/custom-data",
          target: "_blank",
          children: "Metafields & metaobjects"
        })]
      }), /* @__PURE__ */ jsxs("s-paragraph", {
        children: [/* @__PURE__ */ jsx("s-text", {
          children: "Database: "
        }), /* @__PURE__ */ jsx("s-link", {
          href: "https://www.prisma.io/",
          target: "_blank",
          children: "Prisma"
        })]
      })]
    }), /* @__PURE__ */ jsx("s-section", {
      slot: "aside",
      heading: "Next steps",
      children: /* @__PURE__ */ jsxs("s-unordered-list", {
        children: [/* @__PURE__ */ jsxs("s-list-item", {
          children: ["Build an", " ", /* @__PURE__ */ jsx("s-link", {
            href: "https://shopify.dev/docs/apps/getting-started/build-app-example",
            target: "_blank",
            children: "example app"
          })]
        }), /* @__PURE__ */ jsxs("s-list-item", {
          children: ["Explore Shopify's API with", " ", /* @__PURE__ */ jsx("s-link", {
            href: "https://shopify.dev/docs/apps/tools/graphiql-admin-api",
            target: "_blank",
            children: "GraphiQL"
          })]
        })]
      })
    })]
  });
});
const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
const route8 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action,
  default: app__index,
  headers,
  loader
}, Symbol.toStringTag, { value: "Module" }));
const serverManifest = { "entry": { "module": "/assets/entry.client-BvJ0IO1C.js", "imports": ["/assets/jsx-runtime-BKk0dtkS.js"], "css": [] }, "routes": { "root": { "id": "root", "parentId": void 0, "path": "", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/root-BWMGtjFv.js", "imports": ["/assets/jsx-runtime-BKk0dtkS.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/webhooks.app.scopes_update": { "id": "routes/webhooks.app.scopes_update", "parentId": "root", "path": "webhooks/app/scopes_update", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/webhooks.app.scopes_update-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/webhooks.app.uninstalled": { "id": "routes/webhooks.app.uninstalled", "parentId": "root", "path": "webhooks/app/uninstalled", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/webhooks.app.uninstalled-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/auth.login": { "id": "routes/auth.login", "parentId": "root", "path": "auth/login", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/route-ClZzz4lo.js", "imports": ["/assets/jsx-runtime-BKk0dtkS.js", "/assets/AppProxyLink-GfKcfO4_.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/auth.$": { "id": "routes/auth.$", "parentId": "root", "path": "auth/*", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/auth._-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/_index": { "id": "routes/_index", "parentId": "root", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/route-BicseoLb.js", "imports": ["/assets/jsx-runtime-BKk0dtkS.js"], "css": ["/assets/route-CNPfFM0M.css"], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app": { "id": "routes/app", "parentId": "root", "path": "app", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": true, "module": "/assets/app-_LwJSqUI.js", "imports": ["/assets/jsx-runtime-BKk0dtkS.js", "/assets/AppProxyLink-GfKcfO4_.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app.additional": { "id": "routes/app.additional", "parentId": "routes/app", "path": "additional", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/app.additional-Dj9qRcoF.js", "imports": ["/assets/jsx-runtime-BKk0dtkS.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app._index": { "id": "routes/app._index", "parentId": "routes/app", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/app._index-Id74WTMn.js", "imports": ["/assets/jsx-runtime-BKk0dtkS.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 } }, "url": "/assets/manifest-657302c2.js", "version": "657302c2", "sri": void 0 };
const assetsBuildDirectory = "build\\client";
const basename = "/";
const future = { "unstable_optimizeDeps": false, "v8_passThroughRequests": false, "v8_trailingSlashAwareDataRequests": false, "unstable_previewServerPrerendering": false, "v8_middleware": false, "v8_splitRouteModules": false, "v8_viteEnvironmentApi": false };
const ssr = true;
const isSpaMode = false;
const prerender = [];
const routeDiscovery = { "mode": "lazy", "manifestPath": "/__manifest" };
const publicPath = "/";
const entry = { module: entryServer };
const routes = {
  "root": {
    id: "root",
    parentId: void 0,
    path: "",
    index: void 0,
    caseSensitive: void 0,
    module: route0
  },
  "routes/webhooks.app.scopes_update": {
    id: "routes/webhooks.app.scopes_update",
    parentId: "root",
    path: "webhooks/app/scopes_update",
    index: void 0,
    caseSensitive: void 0,
    module: route1
  },
  "routes/webhooks.app.uninstalled": {
    id: "routes/webhooks.app.uninstalled",
    parentId: "root",
    path: "webhooks/app/uninstalled",
    index: void 0,
    caseSensitive: void 0,
    module: route2
  },
  "routes/auth.login": {
    id: "routes/auth.login",
    parentId: "root",
    path: "auth/login",
    index: void 0,
    caseSensitive: void 0,
    module: route3
  },
  "routes/auth.$": {
    id: "routes/auth.$",
    parentId: "root",
    path: "auth/*",
    index: void 0,
    caseSensitive: void 0,
    module: route4
  },
  "routes/_index": {
    id: "routes/_index",
    parentId: "root",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route5
  },
  "routes/app": {
    id: "routes/app",
    parentId: "root",
    path: "app",
    index: void 0,
    caseSensitive: void 0,
    module: route6
  },
  "routes/app.additional": {
    id: "routes/app.additional",
    parentId: "routes/app",
    path: "additional",
    index: void 0,
    caseSensitive: void 0,
    module: route7
  },
  "routes/app._index": {
    id: "routes/app._index",
    parentId: "routes/app",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route8
  }
};
const allowedActionOrigins = false;
export {
  allowedActionOrigins,
  serverManifest as assets,
  assetsBuildDirectory,
  basename,
  entry,
  future,
  isSpaMode,
  prerender,
  publicPath,
  routeDiscovery,
  routes,
  ssr
};
