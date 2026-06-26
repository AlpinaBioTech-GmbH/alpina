// Populate the legal pages (terms, privacy, refund, shipping, accessibility)
// with AlpinaBioTech's real content + last-updated dates, in the heading-based
// rich_text format (no hero). Verify exact legal wording with your own counsel.
import { config } from "dotenv";
config({ path: ".env.local" });
config();

const TOKEN = process.env.STORYBLOK_MANAGEMENT_TOKEN?.trim();
const SPACE = process.env.STORYBLOK_SPACE_ID?.trim();
const REGION = (process.env.NEXT_PUBLIC_STORYBLOK_REGION || "eu").toLowerCase();
const HOST: Record<string, string> = {
  eu: "https://mapi.storyblok.com",
  us: "https://api-us.storyblok.com",
  ap: "https://api-ap.storyblok.com",
  ca: "https://api-ca.storyblok.com",
  cn: "https://app.storyblokchina.com",
};
const BASE = `${HOST[REGION] ?? HOST.eu}/v1/spaces/${SPACE}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function mapi(path: string, init: RequestInit = {}, attempt = 0): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: TOKEN!, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (res.status === 429 && attempt < 6) {
    await sleep(1000 * (attempt + 1));
    return mapi(path, init, attempt + 1);
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`MAPI ${res.status} ${path}: ${text}`);
  return text ? JSON.parse(text) : null;
}

// doc builder: each node is { h } (level-2 heading) or { p } (paragraph)
type Node = { h?: string; p?: string };
const doc = (nodes: Node[]) => ({
  type: "doc",
  content: nodes.map((n) =>
    n.h
      ? { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: n.h }] }
      : { type: "paragraph", content: n.p ? [{ type: "text", text: n.p }] : [] },
  ),
});

type Legal = { slug: string; name: string; updated?: string; nodes: Node[] };

const PAGES: Legal[] = [
  {
    slug: "terms-and-conditions",
    name: "Terms & Conditions",
    updated: "2026-04-07",
    nodes: [
      { h: "§1 Scope" },
      { p: "These Terms & Conditions apply to all contracts, deliveries, and services provided by AlpinaBioTech GmbH (the \"Seller\") to its customers. They apply to commercial customers, research institutions, universities, laboratories, and similar entities. Conflicting customer terms have no effect unless the Seller accepts them in writing." },
      { h: "§2 Subject Matter and Intended Use" },
      { p: "The products are distributed exclusively for research purposes only. They are not intended for diagnostic, therapeutic, or clinical purposes. The customer confirms that trained personnel will use the products in properly equipped laboratories in accordance with applicable safety regulations. Resale to private individuals is prohibited." },
      { h: "§3 Contract Formation" },
      { p: "Product information on the website is an invitation to treat, not a binding offer. A customer order constitutes a binding offer. The contract is concluded only upon written or electronic order confirmation by the Seller. The Seller may request verification of buyer status." },
      { h: "§4 Prices and Payment" },
      { p: "All prices are in EUR, excluding VAT, shipping, and customs duties. Payment is generally due in advance unless otherwise agreed in writing. Invoices are payable within thirty days of issuance. The customer may offset only undisputed or legally established claims." },
      { h: "§5 Delivery, Shipping, and Transfer of Risk" },
      { p: "Delivery is made EU-wide via courier or logistics providers selected by the Seller. Delivery times are non-binding unless expressly confirmed in writing. Risk transfers to the customer upon handover to the courier. The customer must take receipt of the goods immediately and maintain proper temperature storage. The Seller is not liable for courier delays, customs issues, or force majeure." },
      { h: "§6 Retention of Title" },
      { p: "Delivered goods remain the property of the Seller until full payment has been received." },
      { h: "§7 Inspection and Warranty" },
      { p: "The customer must inspect the goods immediately upon receipt. Defects, transport damage, or incorrect deliveries must be reported in writing within 2 business days of delivery; otherwise the goods are deemed accepted. Warranty is limited to replacement delivery. The warranty period is 12 months from delivery. The Seller excludes liability for defects resulting from improper storage, handling, or failure to maintain cooling conditions." },
      { h: "§8 Liability" },
      { p: "The Seller has unlimited liability for intent and gross negligence. For simple negligence, liability is limited to injury to life, body, or health and to the breach of essential contractual obligations. Liability for indirect damages, loss of data, lost profits, or consequential damages is excluded to the extent legally permissible. Liability is also excluded for diagnostic or therapeutic use, contraindicated use, and scientific outcomes." },
      { h: "§9 Returns and Withdrawal" },
      { p: "Consumer withdrawal rights do not apply. Returns are generally excluded due to the nature of laboratory reagents for Research Use Only (RUO). Returns are permitted for incorrect delivery or quality defects reported within five business days. Returns require prior written authorization from the Seller. Original packaging is required. Justified complaints receive a replacement or credit note; refunds are not offered." },
      { h: "§10 Force Majeure" },
      { p: "The Seller is not liable for delays or non-performance caused by circumstances beyond its control, including strikes, natural disasters, pandemics, supply disruptions, manufacturer delays, or courier failures." },
      { h: "§11 Supplier Non-Delivery" },
      { p: "Contracts are subject to supplier delivery. If the Seller does not receive the goods from its suppliers, the Seller may withdraw from the contract. Any prior payments are refunded." },
      { h: "§12 Consulting and Technical Information" },
      { p: "Consulting and product recommendations are non-binding. The customer must verify the suitability of the products for the intended research applications." },
      { h: "§13 Data Protection" },
      { p: "Personal data is processed in accordance with the Seller's Privacy Policy, available on this website." },
      { h: "§14 Governing Law and Jurisdiction" },
      { p: "German law applies, excluding the UN Convention on Contracts for the International Sale of Goods. The exclusive place of jurisdiction for all disputes is the registered office of the Seller, where legally permissible." },
      { h: "§15 Final Provisions" },
      { p: "Rights may not be assigned without the written consent of the Seller. Should any provision be or become invalid, the remaining provisions remain in effect, and the invalid provision is replaced by one that reflects the original commercial intent." },
    ],
  },
  {
    slug: "privacy-policy",
    name: "Privacy Policy",
    updated: "2026-04-07",
    nodes: [
      { h: "1. Data Controller" },
      { p: "AlpinaBioTech GmbH is the controller responsible for your data: Schauinslandstrasse 12, 76199 Karlsruhe, Germany, Commercial Register HRB 757253. Contact: info@alpinabiotech.com." },
      { h: "2. Personal Data We Collect" },
      { p: "We process the information you submit through our contact form or by email, including your name, email address, and message content. No additional data is gathered beyond what you voluntarily provide." },
      { h: "3. Purpose and Legal Basis of Processing" },
      { p: "We process your data to respond to your inquiries. The legal basis is Art. 6(1)(b) GDPR (processing necessary to respond to your inquiry) and our legitimate business interests. Marketing communications require your explicit consent." },
      { h: "4. Data Storage and Retention" },
      { p: "We retain communications only as long as necessary. Inquiry emails are deleted after 12 months. Server logs follow Wix's automatic deletion schedule." },
      { h: "5. Data Recipients and Third-Country Transfers" },
      { p: "Wix.com Ltd. hosts the website and may store data in the European Union, Israel, and the United States. A data processing agreement is in place in accordance with Art. 28 GDPR." },
      { h: "6. Cookies and Analytics" },
      { p: "We do not use analytics tools or marketing cookies. Only essential Wix cookies required for security are used." },
      { h: "7. Your Rights Under the GDPR" },
      { p: "You have the right to access, rectification, erasure, restriction of processing, data portability, objection, and to lodge a complaint. To exercise your rights, contact info@alpinabiotech.com or the competent supervisory authority of Baden-Wuerttemberg." },
      { h: "8. No Automated Decision-Making" },
      { p: "We do not use automated decision-making or profiling." },
      { h: "9. Updates to This Privacy Policy" },
      { p: "We may update this policy periodically. The current version is always available on this website." },
    ],
  },
  {
    slug: "refund-policy",
    name: "Refund Policy",
    updated: "2026-04-07",
    nodes: [
      { p: "Due to the nature of our products, which are laboratory reagents for Research Use Only (RUO), returns are generally excluded." },
      { h: "When returns or replacements are possible" },
      { p: "We accept returns only for damaged or defective goods upon delivery, or for incorrect shipments caused by us." },
      { h: "Notification" },
      { p: "Notify us in writing within 5 business days of delivery. Your notification must include the order number, the batch or lot number, a description of the issue, and photographic documentation of the damage." },
      { h: "Authorization and shipping" },
      { p: "Returns require prior written authorization from the Seller. Unauthorized returns will not be accepted. Returned items must arrive in original or equivalent packaging to avoid transport damage." },
      { h: "Resolution" },
      { p: "If the complaint is justified, the Seller will provide a replacement or a credit note at its discretion. Refunds are not offered." },
    ],
  },
  {
    slug: "shipping-policy",
    name: "Shipping Policy",
    updated: "2026-04-07",
    nodes: [
      { h: "Delivery coverage" },
      { p: "We deliver EU-wide using reliable courier services." },
      { h: "Shipping conditions" },
      { p: "Products are shipped under ambient conditions unless otherwise specified in the product description or order confirmation." },
      { h: "Costs" },
      { p: "Shipping costs depend on the destination and will be communicated before the order is confirmed." },
      { h: "Delivery timeline" },
      { p: "Delivery times are non-binding estimates. The exact delivery timeframe will be stated in the order confirmation." },
      { h: "Transfer of risk" },
      { p: "Risk of accidental loss or damage passes to the customer once the shipment has been handed over to the courier." },
      { h: "Customer responsibility" },
      { p: "The customer is responsible for ensuring timely receipt of the shipment at the delivery address." },
    ],
  },
  {
    slug: "accessibility-statement",
    name: "Accessibility Statement",
    nodes: [
      { p: "AlpinaBioTech strives to make our website accessible to all users, including people with disabilities." },
      { p: "The website is optimized for standard web browsers and mobile devices." },
      { p: "We use clear text structures and labels for improved readability." },
      { p: "If you encounter accessibility issues, please contact us at info@alpinabiotech.com so we can provide the information in an alternative format." },
    ],
  },
];

async function main() {
  for (const page of PAGES) {
    const found = await mapi(`/stories?with_slug=${encodeURIComponent(page.slug)}`);
    const story = found?.stories?.[0];
    if (!story) {
      console.log(`  not found, skipping: ${page.slug}`);
      continue;
    }
    const body = [
      {
        _uid: `${page.slug}-rt`,
        component: "rich_text",
        heading: page.name,
        ...(page.updated ? { last_updated: page.updated } : {}),
        content: doc(page.nodes),
      },
    ];
    await mapi(`/stories/${story.id}`, {
      method: "PUT",
      body: JSON.stringify({
        story: { name: page.name, slug: page.slug, content: { component: "page", body } },
        publish: 1,
      }),
    });
    console.log(`  updated: ${page.slug}${page.updated ? ` (updated ${page.updated})` : ""}`);
    await sleep(250);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
