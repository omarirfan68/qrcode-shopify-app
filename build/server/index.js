var _a;
import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { ServerRouter, UNSAFE_withComponentProps, Meta, Links, Outlet, ScrollRestoration, Scripts, useLoaderData, redirect, useActionData, Form, UNSAFE_withErrorBoundaryProps, useRouteError, useNavigate, useParams, useNavigation, useSubmit } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { isbot } from "isbot";
import "@shopify/shopify-app-react-router/adapters/node";
import { shopifyApp, AppDistribution, ApiVersion, LoginErrorType, boundary } from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { PrismaClient } from "@prisma/client";
import invariant from "tiny-invariant";
import qrcode from "qrcode";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useState, useEffect } from "react";
if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}
const prisma = global.prismaGlobal ?? new PrismaClient();
const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: (_a = process.env.SCOPES) == null ? void 0 : _a.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  ...process.env.SHOP_CUSTOM_DOMAIN ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] } : {}
});
ApiVersion.October25;
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
async function getQRCode(id, graphql) {
  const qrCode = await prisma.qRCode.findFirst({ where: { id } });
  if (!qrCode) {
    return null;
  }
  return supplementQRCode(qrCode, graphql);
}
async function getQRCodes(shop, graphql) {
  const qrCodes = await prisma.qRCode.findMany({
    where: { shop },
    orderBy: { id: "desc" }
  });
  if (qrCodes.length === 0) return [];
  return Promise.all(
    qrCodes.map((qrCode) => supplementQRCode(qrCode, graphql))
  );
}
function getQRCodeImage(id) {
  const url = new URL(`/qrcodes/${id}/scan`, process.env.SHOPIFY_APP_URL);
  return qrcode.toDataURL(url.href);
}
function getDestinationUrl(qrCode) {
  if (qrCode.destination === "product") {
    return `https://${qrCode.shop}/products/${qrCode.productHandle}`;
  }
  const match = /gid:\/\/shopify\/ProductVariant\/([0-9]+)/.exec(qrCode.productVariantId);
  invariant(match, "Unrecognized product variant ID");
  return `https://${qrCode.shop}/cart/${match[1]}:1`;
}
async function supplementQRCode(qrCode, graphql) {
  var _a2, _b, _c, _d, _e, _f, _g, _h;
  const qrCodeImagePromise = getQRCodeImage(qrCode.id);
  const response = await graphql(
    `
      query supplementQRCode($id: ID!) {
        product(id: $id) {
          title
          media(first: 1) {
            nodes {
              preview {
                image {
                  altText
                  url
                }
              }
            }
          }
        }
      }
    `,
    {
      variables: {
        id: qrCode.productId
      }
    }
  );
  const {
    data: { product }
  } = await response.json();
  return {
    ...qrCode,
    productDeleted: !(product == null ? void 0 : product.title),
    productTitle: product == null ? void 0 : product.title,
    productImage: (_d = (_c = (_b = (_a2 = product == null ? void 0 : product.media) == null ? void 0 : _a2.nodes[0]) == null ? void 0 : _b.preview) == null ? void 0 : _c.image) == null ? void 0 : _d.url,
    productAlt: (_h = (_g = (_f = (_e = product == null ? void 0 : product.media) == null ? void 0 : _e.nodes[0]) == null ? void 0 : _f.preview) == null ? void 0 : _g.image) == null ? void 0 : _h.altText,
    destinationUrl: getDestinationUrl(qrCode),
    image: await qrCodeImagePromise
  };
}
function validateQRCode(data) {
  const errors = {};
  if (!data.title) {
    errors.title = "Title is required";
  }
  if (!data.productId) {
    errors.productId = "Product is required";
  }
  if (!data.destination) {
    errors.destination = "Destination is required";
  }
  if (Object.keys(errors).length) {
    return errors;
  }
}
const loader$7 = async ({
  params
}) => {
  invariant(params.id, "Could not find QR code destination");
  const id = Number(params.id);
  const qrCode = await prisma.qRCode.findFirst({
    where: {
      id
    }
  });
  invariant(qrCode, "Could not find QR code destination");
  return {
    title: qrCode.title,
    image: await getQRCodeImage(id)
  };
};
const qrcodes_$id = UNSAFE_withComponentProps(function QRCode() {
  const {
    image,
    title
  } = useLoaderData();
  return /* @__PURE__ */ jsxs(Fragment, {
    children: [/* @__PURE__ */ jsx("h1", {
      children: title
    }), /* @__PURE__ */ jsx("img", {
      src: image,
      alt: `QR Code for product`
    })]
  });
});
const route3 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: qrcodes_$id,
  loader: loader$7
}, Symbol.toStringTag, { value: "Module" }));
const loader$6 = async ({
  params
}) => {
  invariant(params.id, "Could not find QR code destination");
  const id = Number(params.id);
  const qrCode = await prisma.qRCode.findFirst({
    where: {
      id
    }
  });
  invariant(qrCode, "Could not find QR code destination");
  await prisma.qRCode.update({
    where: {
      id
    },
    data: {
      scans: {
        increment: 1
      }
    }
  });
  return redirect(getDestinationUrl(qrCode));
};
const route4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$6
}, Symbol.toStringTag, { value: "Module" }));
function loginErrorMessage(loginErrors) {
  if ((loginErrors == null ? void 0 : loginErrors.shop) === LoginErrorType.MissingShop) {
    return { shop: "Please enter your shop domain to log in" };
  } else if ((loginErrors == null ? void 0 : loginErrors.shop) === LoginErrorType.InvalidShop) {
    return { shop: "Please enter a valid shop domain to log in" };
  }
  return {};
}
const loader$5 = async ({
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
const route5 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$1,
  default: route$1,
  loader: loader$5
}, Symbol.toStringTag, { value: "Module" }));
const index = "_index_12o3y_1";
const heading = "_heading_12o3y_11";
const text = "_text_12o3y_12";
const content = "_content_12o3y_22";
const form = "_form_12o3y_27";
const label = "_label_12o3y_35";
const input = "_input_12o3y_43";
const button = "_button_12o3y_47";
const list = "_list_12o3y_51";
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
const loader$4 = async ({
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
const route6 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: route,
  loader: loader$4
}, Symbol.toStringTag, { value: "Module" }));
const loader$3 = async ({
  request
}) => {
  await authenticate.admin(request);
  return null;
};
const headers$3 = (headersArgs) => {
  return boundary.headers(headersArgs);
};
const route7 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  headers: headers$3,
  loader: loader$3
}, Symbol.toStringTag, { value: "Module" }));
const loader$2 = async ({
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
const headers$2 = (headersArgs) => {
  return boundary.headers(headersArgs);
};
const route8 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ErrorBoundary,
  default: app,
  headers: headers$2,
  loader: loader$2
}, Symbol.toStringTag, { value: "Module" }));
async function loader$1({
  request,
  params
}) {
  const {
    admin
  } = await authenticate.admin(request);
  if (params.id === "new") {
    return {
      destination: "product",
      title: ""
    };
  }
  return await getQRCode(Number(params.id), admin.graphql);
}
async function action({
  request,
  params
}) {
  const {
    session,
    redirect: redirect2
  } = await authenticate.admin(request);
  const {
    shop
  } = session;
  const data = {
    ...Object.fromEntries(await request.formData()),
    shop
  };
  if (data.action === "delete") {
    await prisma.qRCode.delete({
      where: {
        id: Number(params.id)
      }
    });
    return redirect2("/app");
  }
  const errors = validateQRCode(data);
  if (errors) {
    return new Response(JSON.stringify({
      errors
    }), {
      status: 422,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
  const qrCode = params.id === "new" ? await prisma.qRCode.create({
    data
  }) : await prisma.qRCode.update({
    where: {
      id: Number(params.id)
    },
    data
  });
  return redirect2(`/app/qrcodes/${qrCode.id}`);
}
const app_qrcodes_$id = UNSAFE_withComponentProps(function QRCodeForm() {
  var _a2;
  const navigate = useNavigate();
  const {
    id
  } = useParams();
  const qrCode = useLoaderData();
  const [initialFormState, setInitialFormState] = useState(qrCode);
  const [formState, setFormState] = useState(qrCode);
  const errors = ((_a2 = useActionData()) == null ? void 0 : _a2.errors) || {};
  useNavigation().state === "submitting";
  const isDirty = JSON.stringify(formState) !== JSON.stringify(initialFormState);
  async function selectProduct() {
    var _a3, _b;
    const products = await window.shopify.resourcePicker({
      type: "product",
      action: "select"
      // customized action verb, either 'select' or 'add',
    });
    if (products) {
      const {
        images,
        id: id2,
        variants,
        title,
        handle
      } = products[0];
      setFormState({
        ...formState,
        productId: id2,
        productVariantId: variants[0].id,
        productTitle: title,
        productHandle: handle,
        productAlt: (_a3 = images[0]) == null ? void 0 : _a3.altText,
        productImage: (_b = images[0]) == null ? void 0 : _b.originalSrc
      });
    }
  }
  function removeProduct() {
    setFormState({
      title: formState.title,
      destination: formState.destination
    });
  }
  const productUrl = formState.productId ? `shopify://admin/products/${formState.productId.split("/").at(-1)}` : "";
  const submit = useSubmit();
  function handleSave() {
    const data = {
      title: formState.title,
      productId: formState.productId || "",
      productVariantId: formState.productVariantId || "",
      productHandle: formState.productHandle || "",
      destination: formState.destination
    };
    submit(data, {
      method: "post"
    });
  }
  function handleDelete() {
    submit({
      action: "delete"
    }, {
      method: "post"
    });
  }
  function handleReset() {
    setFormState(initialFormState);
    window.shopify.saveBar.hide("qr-code-form");
  }
  useEffect(() => {
    if (isDirty) {
      window.shopify.saveBar.show("qr-code-form");
    } else {
      window.shopify.saveBar.hide("qr-code-form");
    }
    return () => {
      window.shopify.saveBar.hide("qr-code-form");
    };
  }, [isDirty]);
  useEffect(() => {
    setInitialFormState(qrCode);
    setFormState(qrCode);
  }, [id, qrCode]);
  return /* @__PURE__ */ jsx(Fragment, {
    children: /* @__PURE__ */ jsx("form", {
      "data-save-bar": true,
      onSubmit: handleSave,
      onReset: handleReset,
      children: /* @__PURE__ */ jsxs("s-page", {
        heading: initialFormState.title || "Create QR code",
        children: [/* @__PURE__ */ jsx("s-link", {
          href: "/app",
          slot: "breadcrumb-actions",
          onClick: (e) => isDirty ? e.preventDefault() : navigate("/app/"),
          children: "QR Codes"
        }), initialFormState.id && /* @__PURE__ */ jsx("s-button", {
          slot: "secondary-actions",
          onClick: handleDelete,
          children: "Delete"
        }), /* @__PURE__ */ jsx("s-section", {
          heading: "QR Code information",
          children: /* @__PURE__ */ jsxs("s-stack", {
            gap: "base",
            children: [/* @__PURE__ */ jsx("s-text-field", {
              label: "Title",
              details: "Only store staff can see this title",
              error: errors.title,
              autoComplete: "off",
              name: "title",
              value: formState.title,
              onInput: (e) => setFormState({
                ...formState,
                title: e.target.value
              })
            }), /* @__PURE__ */ jsxs("s-stack", {
              gap: "500",
              align: "space-between",
              blockAlign: "start",
              children: [/* @__PURE__ */ jsxs("s-select", {
                name: "destination",
                label: "Scan destination",
                value: formState.destination,
                onChange: (e) => setFormState({
                  ...formState,
                  destination: e.target.value
                }),
                children: [/* @__PURE__ */ jsx("s-option", {
                  value: "product",
                  selected: formState.destination === "product",
                  children: "Link to product page"
                }), /* @__PURE__ */ jsx("s-option", {
                  value: "cart",
                  selected: formState.destination === "cart",
                  children: "Link to checkout page with product in the cart"
                })]
              }), initialFormState.destinationUrl ? /* @__PURE__ */ jsx("s-link", {
                variant: "plain",
                href: initialFormState.destinationUrl,
                target: "_blank",
                children: "Go to destination URL"
              }) : null]
            }), /* @__PURE__ */ jsxs("s-stack", {
              gap: "small-400",
              children: [/* @__PURE__ */ jsxs("s-stack", {
                direction: "inline",
                gap: "small-100",
                justifyContent: "space-between",
                children: [/* @__PURE__ */ jsx("s-text", {
                  color: "subdued",
                  children: "Product"
                }), formState.productId ? /* @__PURE__ */ jsx("s-link", {
                  onClick: removeProduct,
                  accessibilityLabel: "Remove the product from this QR Code",
                  variant: "tertiary",
                  tone: "neutral",
                  children: "Clear"
                }) : null]
              }), formState.productId ? /* @__PURE__ */ jsxs("s-stack", {
                direction: "inline",
                justifyContent: "space-between",
                alignItems: "center",
                children: [/* @__PURE__ */ jsxs("s-stack", {
                  direction: "inline",
                  gap: "small-100",
                  alignItems: "center",
                  children: [/* @__PURE__ */ jsx("s-clickable", {
                    href: productUrl,
                    target: "_blank",
                    accessibilityLabel: `Go to the product page for ${formState.productTitle}`,
                    borderRadius: "base",
                    children: /* @__PURE__ */ jsx("s-box", {
                      padding: "small-200",
                      border: "base",
                      borderRadius: "base",
                      background: "subdued",
                      inlineSize: "38px",
                      blockSize: "38px",
                      children: formState.productImage ? /* @__PURE__ */ jsx("s-image", {
                        src: formState.productImage
                      }) : /* @__PURE__ */ jsx("s-icon", {
                        size: "large",
                        type: "product"
                      })
                    })
                  }), /* @__PURE__ */ jsx("s-link", {
                    href: productUrl,
                    target: "_blank",
                    children: formState.productTitle
                  })]
                }), /* @__PURE__ */ jsx("s-stack", {
                  direction: "inline",
                  gap: "small",
                  children: /* @__PURE__ */ jsx("s-button", {
                    onClick: selectProduct,
                    accessibilityLabel: "Change the product the QR code should be for",
                    children: "Change"
                  })
                })]
              }) : /* @__PURE__ */ jsx("s-button", {
                onClick: selectProduct,
                accessibilityLabel: "Select the product the QR code should be for",
                children: "Select product"
              })]
            })]
          })
        }), /* @__PURE__ */ jsx("s-box", {
          slot: "aside",
          children: /* @__PURE__ */ jsx("s-section", {
            heading: "Preview",
            children: /* @__PURE__ */ jsxs("s-stack", {
              gap: "base",
              children: [/* @__PURE__ */ jsx("s-box", {
                padding: "base",
                border: "none",
                borderRadius: "base",
                background: "subdued",
                children: initialFormState.image ? /* @__PURE__ */ jsx("s-image", {
                  aspectRatio: "1/0.8",
                  src: initialFormState.image,
                  alt: "The QR Code for the current form"
                }) : /* @__PURE__ */ jsx("s-stack", {
                  direction: "inline",
                  alignItems: "center",
                  justifyContent: "center",
                  blockSize: "198px",
                  children: /* @__PURE__ */ jsx("s-text", {
                    color: "subdued",
                    children: "See a preview once you save"
                  })
                })
              }), /* @__PURE__ */ jsxs("s-stack", {
                gap: "small",
                direction: "inline",
                alignItems: "center",
                justifyContent: "space-between",
                children: [/* @__PURE__ */ jsx("s-button", {
                  disabled: !initialFormState.id,
                  href: `/qrcodes/${initialFormState.id}`,
                  target: "_blank",
                  children: "Go to public URL"
                }), /* @__PURE__ */ jsx("s-button", {
                  disabled: !(initialFormState == null ? void 0 : initialFormState.image),
                  href: initialFormState == null ? void 0 : initialFormState.image,
                  download: true,
                  variant: "primary",
                  children: "Download"
                })]
              })]
            })
          })
        })]
      })
    })
  });
});
const headers$1 = (headersArgs) => {
  return boundary.headers(headersArgs);
};
const route9 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action,
  default: app_qrcodes_$id,
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
const route10 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: app_additional
}, Symbol.toStringTag, { value: "Module" }));
async function loader({
  request
}) {
  const {
    admin,
    session
  } = await authenticate.admin(request);
  const qrCodes = await getQRCodes(session.shop, admin.graphql);
  return {
    qrCodes
  };
}
const EmptyQRCodeState = () => /* @__PURE__ */ jsx("s-section", {
  accessibilityLabel: "Empty state section",
  children: /* @__PURE__ */ jsxs("s-grid", {
    gap: "base",
    justifyItems: "center",
    paddingBlock: "large-400",
    children: [/* @__PURE__ */ jsx("s-box", {
      maxInlineSize: "200px",
      maxBlockSize: "200px",
      children: /* @__PURE__ */ jsx("s-image", {
        aspectRatio: "1/0.5",
        src: "https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png",
        alt: "A stylized graphic of a document"
      })
    }), /* @__PURE__ */ jsxs("s-grid", {
      justifyItems: "center",
      maxBlockSize: "450px",
      maxInlineSize: "450px",
      children: [/* @__PURE__ */ jsx("s-heading", {
        children: "Create unique QR codes for your products"
      }), /* @__PURE__ */ jsx("s-paragraph", {
        children: "Allow customers to scan codes and buy products using their phones."
      }), /* @__PURE__ */ jsx("s-stack", {
        gap: "small-200",
        justifyContent: "center",
        padding: "base",
        paddingBlockEnd: "none",
        direction: "inline",
        children: /* @__PURE__ */ jsx("s-button", {
          href: "/app/qrcodes/new",
          variant: "primary",
          children: "Create QR code"
        })
      })]
    })]
  })
});
function truncate(str, {
  length = 25
} = {}) {
  if (!str) return "";
  if (str.length <= length) return str;
  return str.slice(0, length) + "…";
}
const QRTable = ({
  qrCodes
}) => /* @__PURE__ */ jsx("s-section", {
  padding: "none",
  accessibilityLabel: "QRCode table",
  children: /* @__PURE__ */ jsxs("s-table", {
    children: [/* @__PURE__ */ jsxs("s-table-header-row", {
      children: [/* @__PURE__ */ jsx("s-table-header", {
        listSlot: "primary",
        children: "Title"
      }), /* @__PURE__ */ jsx("s-table-header", {
        children: "Product"
      }), /* @__PURE__ */ jsx("s-table-header", {
        children: "Date created"
      }), /* @__PURE__ */ jsx("s-table-header", {
        children: "Scans"
      })]
    }), /* @__PURE__ */ jsx("s-table-body", {
      children: qrCodes.map((qrCode) => /* @__PURE__ */ jsx(QRTableRow, {
        qrCode
      }, qrCode.id))
    })]
  })
});
const QRTableRow = ({
  qrCode
}) => /* @__PURE__ */ jsxs("s-table-row", {
  id: qrCode.id,
  position: qrCode.id,
  children: [/* @__PURE__ */ jsx("s-table-cell", {
    children: /* @__PURE__ */ jsxs("s-stack", {
      direction: "inline",
      gap: "small",
      alignItems: "center",
      children: [/* @__PURE__ */ jsx("s-clickable", {
        href: `/app/qrcodes/${qrCode.id}`,
        accessibilityLabel: `Go to the product page for ${qrCode.productTitle}`,
        border: "base",
        borderRadius: "base",
        overflow: "hidden",
        inlineSize: "20px",
        blockSize: "20px",
        children: qrCode.productImage ? /* @__PURE__ */ jsx("s-image", {
          objectFit: "cover",
          src: qrCode.productImage
        }) : /* @__PURE__ */ jsx("s-icon", {
          size: "large",
          type: "image"
        })
      }), /* @__PURE__ */ jsx("s-link", {
        href: `/app/qrcodes/${qrCode.id}`,
        children: truncate(qrCode.title)
      })]
    })
  }), /* @__PURE__ */ jsx("s-table-cell", {
    children: qrCode.productDeleted ? /* @__PURE__ */ jsx("s-badge", {
      icon: "alert-diamond",
      tone: "critical",
      children: "Product has been deleted"
    }) : truncate(qrCode.productTitle)
  }), /* @__PURE__ */ jsx("s-table-cell", {
    children: new Date(qrCode.createdAt).toDateString()
  }), /* @__PURE__ */ jsx("s-table-cell", {
    children: qrCode.scans
  })]
});
const app__index = UNSAFE_withComponentProps(function Index() {
  const {
    qrCodes
  } = useLoaderData();
  return /* @__PURE__ */ jsxs("s-page", {
    heading: "QR codes",
    children: [/* @__PURE__ */ jsx("s-link", {
      slot: "secondary-actions",
      href: "/app/qrcodes/new",
      children: "Create QR code"
    }), qrCodes.length === 0 ? /* @__PURE__ */ jsx(EmptyQRCodeState, {}) : /* @__PURE__ */ jsx(QRTable, {
      qrCodes
    })]
  });
});
const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
const route11 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: app__index,
  headers,
  loader
}, Symbol.toStringTag, { value: "Module" }));
const serverManifest = { "entry": { "module": "/assets/entry.client-DK-9h4ah.js", "imports": ["/assets/chunk-WWGJGFF6-C-7sk41n.js"], "css": [] }, "routes": { "root": { "id": "root", "parentId": void 0, "path": "", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/root-KnPdoEms.js", "imports": ["/assets/chunk-WWGJGFF6-C-7sk41n.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/webhooks.app.scopes_update": { "id": "routes/webhooks.app.scopes_update", "parentId": "root", "path": "webhooks/app/scopes_update", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/webhooks.app.scopes_update-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/webhooks.app.uninstalled": { "id": "routes/webhooks.app.uninstalled", "parentId": "root", "path": "webhooks/app/uninstalled", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/webhooks.app.uninstalled-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/qrcodes.$id": { "id": "routes/qrcodes.$id", "parentId": "root", "path": "qrcodes/:id", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/qrcodes._id-CF7X_QrL.js", "imports": ["/assets/chunk-WWGJGFF6-C-7sk41n.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/qrcodes.$id.scan": { "id": "routes/qrcodes.$id.scan", "parentId": "routes/qrcodes.$id", "path": "scan", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/qrcodes._id.scan-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/auth.login": { "id": "routes/auth.login", "parentId": "root", "path": "auth/login", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/route-0hiFA_h_.js", "imports": ["/assets/chunk-WWGJGFF6-C-7sk41n.js", "/assets/AppProxyProvider-BCo0MC08.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/_index": { "id": "routes/_index", "parentId": "root", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/route-CEs2V5jv.js", "imports": ["/assets/chunk-WWGJGFF6-C-7sk41n.js"], "css": ["/assets/route-Xpdx9QZl.css"], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/auth.$": { "id": "routes/auth.$", "parentId": "root", "path": "auth/*", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/auth._-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app": { "id": "routes/app", "parentId": "root", "path": "app", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": true, "module": "/assets/app-OKjmgCnb.js", "imports": ["/assets/chunk-WWGJGFF6-C-7sk41n.js", "/assets/AppProxyProvider-BCo0MC08.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app.qrcodes.$id": { "id": "routes/app.qrcodes.$id", "parentId": "routes/app", "path": "qrcodes/:id", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/app.qrcodes._id-j-Qvwcpv.js", "imports": ["/assets/chunk-WWGJGFF6-C-7sk41n.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app.additional": { "id": "routes/app.additional", "parentId": "routes/app", "path": "additional", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/app.additional-qdfkG25m.js", "imports": ["/assets/chunk-WWGJGFF6-C-7sk41n.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app._index": { "id": "routes/app._index", "parentId": "routes/app", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/app._index-DumS08RM.js", "imports": ["/assets/chunk-WWGJGFF6-C-7sk41n.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 } }, "url": "/assets/manifest-b3b1baf5.js", "version": "b3b1baf5", "sri": void 0 };
const assetsBuildDirectory = "build/client";
const basename = "/";
const future = { "unstable_optimizeDeps": false, "unstable_subResourceIntegrity": false, "v8_middleware": false, "v8_splitRouteModules": false, "v8_viteEnvironmentApi": false };
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
  "routes/qrcodes.$id": {
    id: "routes/qrcodes.$id",
    parentId: "root",
    path: "qrcodes/:id",
    index: void 0,
    caseSensitive: void 0,
    module: route3
  },
  "routes/qrcodes.$id.scan": {
    id: "routes/qrcodes.$id.scan",
    parentId: "routes/qrcodes.$id",
    path: "scan",
    index: void 0,
    caseSensitive: void 0,
    module: route4
  },
  "routes/auth.login": {
    id: "routes/auth.login",
    parentId: "root",
    path: "auth/login",
    index: void 0,
    caseSensitive: void 0,
    module: route5
  },
  "routes/_index": {
    id: "routes/_index",
    parentId: "root",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route6
  },
  "routes/auth.$": {
    id: "routes/auth.$",
    parentId: "root",
    path: "auth/*",
    index: void 0,
    caseSensitive: void 0,
    module: route7
  },
  "routes/app": {
    id: "routes/app",
    parentId: "root",
    path: "app",
    index: void 0,
    caseSensitive: void 0,
    module: route8
  },
  "routes/app.qrcodes.$id": {
    id: "routes/app.qrcodes.$id",
    parentId: "routes/app",
    path: "qrcodes/:id",
    index: void 0,
    caseSensitive: void 0,
    module: route9
  },
  "routes/app.additional": {
    id: "routes/app.additional",
    parentId: "routes/app",
    path: "additional",
    index: void 0,
    caseSensitive: void 0,
    module: route10
  },
  "routes/app._index": {
    id: "routes/app._index",
    parentId: "routes/app",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route11
  }
};
export {
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
