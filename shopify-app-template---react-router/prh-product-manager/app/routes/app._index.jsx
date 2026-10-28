import { useEffect } from "react";
import { useFetcher, useLoaderData, useRevalidator } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { suggestSpanishTitle, syncProductTitles } from "../product-title.server";

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
  const pending = products.filter((product) => {
    const title = savedTitles.get(product.id)?.spanishTitle;
    return title && title !== product.spanishTitle?.value;
  });
  for (let index = 0; index < pending.length; index += 25) {
    const metafields = pending.slice(index, index + 25).map((product) => ({
      ownerId: product.id,
      namespace: "custom",
      key: "nombre_breve_es",
      type: "single_line_text_field",
      value: savedTitles.get(product.id).spanishTitle,
    }));
    const response = await admin.graphql(SAVE_DISPLAY_TITLES, { variables: { metafields } });
    const result = await response.json();
    const errors = result.data?.metafieldsSet?.userErrors ?? result.errors ?? [];
    if (errors.length) console.error("No se pudieron publicar algunos nombres breves:", errors);
  }
}

const normalizeProductText = (value = "") =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const shortProductTitle = (title = "", vendor = "") => {
  const normalizedVendor = normalizeProductText(vendor);
  const cleanSegments = title
    .replace(/\s+/g, " ")
    .split(/\s*[|•·]\s*/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const uniqueSegments = cleanSegments.filter(
    (segment, index) =>
      cleanSegments.findIndex(
        (candidate) => normalizeProductText(candidate) === normalizeProductText(segment),
      ) === index,
  );

  let concise = uniqueSegments.join(" ").replace(/\s+/g, " ").trim();
  let words = concise.split(" ");
  if (normalizedVendor && words.length > 1) {
    if (normalizeProductText(words[0]) === normalizedVendor) words = words.slice(1);
    if (words.length > 1 && normalizeProductText(words.at(-1)) === normalizedVendor) {
      words = words.slice(0, -1);
    }
  }

  // Remove only immediately repeated words; repetitions elsewhere may be meaningful.
  concise = words.filter((word, index) =>
    index === 0 || normalizeProductText(word) !== normalizeProductText(words[index - 1]),
  ).join(" ");

  const maxLength = 56;
  if (concise.length <= maxLength) return concise || title;
  const shortened = concise.slice(0, maxLength - 1);
  const lastWordBoundary = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, lastWordBoundary > 28 ? lastWordBoundary : maxLength - 1).trimEnd()}…`;
};

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const search = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const normalizedSearch = normalizeProductText(search);
  const terms = [...new Set(normalizedSearch.split(" ").filter(Boolean))];
  // Shopify supports prefix wildcards. Sanitized normalized terms keep user input
  // out of the search grammar while the local matcher handles punctuation.
  const shopifyQuery = terms.length
    ? terms.map((term) => `title:${term}*`).join(" OR ")
    : undefined;

  let after = null;
  let hasNextPage = true;
  const products = [];
  let currencyCode = "COP";
  do {
    const response = await admin.graphql(PRODUCT_SEARCH, {
      variables: {
        first: 250,
        after,
        query: shopifyQuery,
      },
    });
    const data = await response.json();
    if (data.errors?.length) throw new Error("No se pudieron consultar los productos de Shopify.");
    const connection = data.data.products;
    currencyCode = data.data.shop.currencyCode;
    products.push(...connection.nodes);
    hasNextPage = Boolean(connection.pageInfo.hasNextPage);
    after = connection.pageInfo.endCursor;
  } while (hasNextPage);

  // Keep a shop-scoped local index and discover new products during catalog sync.
  // The only Shopify write is the dedicated display-name metafield used by the theme.
  const savedTitles = await syncProductTitles(prisma, session.shop, products);
  try {
    await publishDisplayTitles(admin, products, savedTitles);
  } catch (error) {
    console.error("No se pudieron sincronizar los nombres breves con el tema:", error);
  }

  const rankedProducts = products
    .map((product) => {
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
        displayTitle: savedTitles.get(product.id)?.spanishTitle ?? suggestSpanishTitle(product.title, product.vendor),
        _rank: rank,
      };
    })
    .filter((product) => product._rank < 99)
    .sort((a, b) => a._rank - b._rank || a.displayTitle.localeCompare(b.displayTitle, "es"));

  return { products: rankedProducts, search, currencyCode };
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  if (formData.get("intent") === "save-spanish-title") {
    const productGid = String(formData.get("productGid") ?? "");
    const spanishTitle = String(formData.get("spanishTitle") ?? "").trim();
    if (!productGid.startsWith("gid://shopify/Product/") || !spanishTitle || spanishTitle.length > 80) {
      return { error: "Escribe un nombre en español de hasta 80 caracteres." };
    }
    const metafieldResponse = await admin.graphql(SAVE_DISPLAY_TITLES, {
      variables: {
        metafields: [{
          ownerId: productGid,
          namespace: "custom",
          key: "nombre_breve_es",
          type: "single_line_text_field",
          value: spanishTitle,
        }],
      },
    });
    const metafieldResult = await metafieldResponse.json();
    const metafieldErrors = metafieldResult.data?.metafieldsSet?.userErrors ?? metafieldResult.errors ?? [];
    if (metafieldErrors.length) return { error: "No se pudo actualizar el nombre visible en la tienda." };
    await prisma.productTitle.updateMany({
      where: { shop: session.shop, productGid },
      data: { spanishTitle },
    });
    return { saved: true };
  }
  const color = ["Red", "Orange", "Yellow", "Green"][
    Math.floor(Math.random() * 4)
  ];
  const response = await admin.graphql(
    `#graphql
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
      }`,
    {
      variables: {
        product: {
          title: `${color} Snowboard`,
          metafields: [
            {
              namespace: "$app",
              key: "demo_info",
              value: "Created by React Router Template",
            },
          ],
        },
      },
    },
  );
  const responseJson = await response.json();
  const product = responseJson.data.productCreate.product;
  const variantId = product.variants.edges[0].node.id;
  const variantResponse = await admin.graphql(
    `#graphql
    mutation shopifyReactRouterTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`,
    {
      variables: {
        productId: product.id,
        variants: [{ id: variantId, price: "100.00" }],
      },
    },
  );
  const variantResponseJson = await variantResponse.json();
  const metaobjectResponse = await admin.graphql(
    `#graphql
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
    }`,
    {
      variables: {
        handle: {
          type: "$app:example",
          handle: "demo-entry",
        },
        values: {
          title: "Demo Entry",
          description:
            "This metaobject was created by the Shopify app template to demonstrate the metaobject API.",
        },
      },
    },
  );
  const metaobjectResponseJson = await metaobjectResponse.json();

  return {
    product: responseJson.data.productCreate.product,
    variant: variantResponseJson.data.productVariantsBulkUpdate.productVariants,
    metaobject: metaobjectResponseJson.data.metaobjectUpsert.metaobject,
  };
};

export default function Index() {
  const { products, search, currencyCode } = useLoaderData();
  const fetcher = useFetcher();
  const { revalidate } = useRevalidator();
  const shopify = useAppBridge();
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") revalidate();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [revalidate]);
  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  useEffect(() => {
    if (fetcher.data?.product?.id) {
      shopify.toast.show("Product created");
    }
  }, [fetcher.data?.product?.id, shopify]);
  const generateProduct = () => fetcher.submit({}, { method: "POST" });

  return (
    <s-page heading="Gestor de productos">
      <s-button slot="primary-action" onClick={generateProduct}>
        Generate a product
      </s-button>

      <s-section heading="Congrats on creating a new Shopify app 🎉">
        <s-paragraph>
          This embedded app template uses{" "}
          <s-link
            href="https://shopify.dev/docs/apps/tools/app-bridge"
            target="_blank"
          >
            App Bridge
          </s-link>{" "}
          interface examples like an{" "}
          <s-link href="/app/additional">additional page in the app nav</s-link>
          , as well as an{" "}
          <s-link
            href="https://shopify.dev/docs/api/admin-graphql"
            target="_blank"
          >
            Admin GraphQL
          </s-link>{" "}
          mutation demo, to provide a starting point for app development.
        </s-paragraph>
      </s-section>
      <s-section heading="Productos">
        <s-paragraph>
          Busca por nombre; se ignoran mayúsculas, tildes y signos. Los títulos
          originales de Shopify se conservan y aquí se muestran de forma breve.
        </s-paragraph>
        <form method="get" style={{ display: "flex", gap: "0.75rem", alignItems: "end", marginBottom: "1rem" }}>
          <s-text-field
            label="Buscar productos"
            name="q"
            value={search}
            placeholder="Ej.: camisa azul"
          />
          <s-button type="submit" variant="primary">Buscar</s-button>
          {search && <s-button href="/app">Limpiar</s-button>}
        </form>
        <s-paragraph>
          {products.length} {products.length === 1 ? "producto" : "productos"}
          {search ? ` para “${search}”` : " recientes"}
        </s-paragraph>
        {products.length ? (
          <s-table>
            <s-table-header-row>
              <s-table-header>Producto</s-table-header>
              <s-table-header>Precio desde</s-table-header>
              <s-table-header>Inventario</s-table-header>
            </s-table-header-row>
            <s-table-body>
          {products.map((product) => (
                <s-table-row key={product.id}>
                  <s-table-cell>
                    <strong title={`Título original: ${product.title}`}>{product.displayTitle}</strong>
                    <br />
                    <small>{product.vendor || product.handle}</small>
                    <form method="post" style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem" }}>
                      <input type="hidden" name="intent" value="save-spanish-title" />
                      <input type="hidden" name="productGid" value={product.id} />
                      <input name="spanishTitle" defaultValue={product.displayTitle} aria-label={`Nombre en español de ${product.displayTitle}`} maxLength={80} style={{ minWidth: 0, width: "14rem" }} />
                      <button type="submit">Guardar</button>
                    </form>
                  </s-table-cell>
                  <s-table-cell>
                    {product.variants.nodes[0]?.price != null
                      ? new Intl.NumberFormat("es-CO", {
                          style: "currency",
                          currency: currencyCode,
                        }).format(Number(product.variants.nodes[0].price))
                      : "—"}
                  </s-table-cell>
                  <s-table-cell>{product.totalInventory ?? "—"}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        ) : (
          <s-paragraph>No se encontraron productos con ese nombre.</s-paragraph>
        )}
      </s-section>
      <s-section heading="Get started with products">
        <s-paragraph>
          Generate a product with GraphQL and get the JSON output for that
          product. Learn more about the{" "}
          <s-link
            href="https://shopify.dev/docs/api/admin-graphql/latest/mutations/productCreate"
            target="_blank"
          >
            productCreate
          </s-link>{" "}
          mutation in our API references. Includes a product{" "}
          <s-link
            href="https://shopify.dev/docs/apps/build/custom-data/metafields"
            target="_blank"
          >
            metafield
          </s-link>{" "}
          and{" "}
          <s-link
            href="https://shopify.dev/docs/apps/build/custom-data/metaobjects"
            target="_blank"
          >
            metaobject
          </s-link>
          .
        </s-paragraph>
        <s-stack direction="inline" gap="base">
          <s-button
            onClick={generateProduct}
            {...(isLoading ? { loading: true } : {})}
          >
            Generate a product
          </s-button>
          {fetcher.data?.product && (
            <s-button
              onClick={() => {
                shopify.intents.invoke?.("edit:shopify/Product", {
                  value: fetcher.data?.product?.id,
                });
              }}
              target="_blank"
              variant="tertiary"
            >
              Edit product
            </s-button>
          )}
        </s-stack>
        {fetcher.data?.product && (
          <s-section heading="productCreate mutation">
            <s-stack direction="block" gap="base">
              <s-box
                padding="base"
                borderWidth="base"
                borderRadius="base"
                background="subdued"
              >
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  <code>{JSON.stringify(fetcher.data.product, null, 2)}</code>
                </pre>
              </s-box>

              <s-heading>productVariantsBulkUpdate mutation</s-heading>
              <s-box
                padding="base"
                borderWidth="base"
                borderRadius="base"
                background="subdued"
              >
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  <code>{JSON.stringify(fetcher.data.variant, null, 2)}</code>
                </pre>
              </s-box>

              <s-heading>metaobjectUpsert mutation</s-heading>
              <s-box
                padding="base"
                borderWidth="base"
                borderRadius="base"
                background="subdued"
              >
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  <code>
                    {JSON.stringify(fetcher.data.metaobject, null, 2)}
                  </code>
                </pre>
              </s-box>
            </s-stack>
          </s-section>
        )}
      </s-section>

      <s-section slot="aside" heading="App template specs">
        <s-paragraph>
          <s-text>Framework: </s-text>
          <s-link href="https://reactrouter.com/" target="_blank">
            React Router
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-text>Interface: </s-text>
          <s-link
            href="https://shopify.dev/docs/api/app-home/using-polaris-components"
            target="_blank"
          >
            Polaris web components
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-text>API: </s-text>
          <s-link
            href="https://shopify.dev/docs/api/admin-graphql"
            target="_blank"
          >
            GraphQL
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-text>Custom data: </s-text>
          <s-link
            href="https://shopify.dev/docs/apps/build/custom-data"
            target="_blank"
          >
            Metafields &amp; metaobjects
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-text>Database: </s-text>
          <s-link href="https://www.prisma.io/" target="_blank">
            Prisma
          </s-link>
        </s-paragraph>
      </s-section>

      <s-section slot="aside" heading="Next steps">
        <s-unordered-list>
          <s-list-item>
            Build an{" "}
            <s-link
              href="https://shopify.dev/docs/apps/getting-started/build-app-example"
              target="_blank"
            >
              example app
            </s-link>
          </s-list-item>
          <s-list-item>
            Explore Shopify&apos;s API with{" "}
            <s-link
              href="https://shopify.dev/docs/apps/tools/graphiql-admin-api"
              target="_blank"
            >
              GraphiQL
            </s-link>
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

