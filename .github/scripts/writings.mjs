/**
 * Refreshes the README's Writings list from the portfolio's RSS feed.
 * It rewrites only what sits between the writings markers, and leaves the file as it
 * was if the feed cannot be read.
 *
 *   node .github/scripts/writings.mjs [file]
 */
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";



const FEED = "https://ouss.es/p/rss.xml";
const ALL = "https://ouss.es/?list=posts";
const SHOWN = 2;
const FILE = process.argv[2] ?? "README.md";
const START = "<!-- writings:start -->";
const END = "<!-- writings:end -->";

/** As the site writes dates: 20 July 2025. */
const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/**
 * Turns a piece of the feed back into plain text.
 *
 * @param text - Text as the feed holds it, with entities and maybe CDATA
 * @returns The plain text
 */
function decode(text) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

/**
 * Reads one element's text out of a feed item.
 *
 * @param xml - The item
 * @param name - The element's name
 * @returns Its text, or an empty string when it is missing
 */
function field(xml, name) {
  const match = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));

  return match ? decode(match[1]) : "";
}

/**
 * Reads the posts out of the feed, newest first.
 *
 * @param xml - The whole feed
 * @returns The posts
 */
function parse(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map(([, item]) => ({
      title: field(item, "title"),
      link: field(item, "link"),
      summary: field(item, "description"),
      date: new Date(field(item, "pubDate")),
    }))
    .filter(post => post.title && post.link && !Number.isNaN(post.date.getTime()))
    .sort((a, b) => b.date - a.date);
}

/**
 * The list marker, linked as its line is, so GitHub does not link it to the image.
 *
 * @param href - Where the line leads
 * @returns The marker
 */
function dot(href) {
  return `<a href="${href}"><img src="assets/dot-cross.svg" alt="" /></a>&ensp;`;
}

/**
 * One post's line: its name, its summary on hover, and its date.
 *
 * @param post - The post
 * @returns The line
 */
function line(post) {
  const label = post.title.replace(/([\\[\]])/g, "\\$1");
  const hover = post.summary ? ` "${post.summary.replace(/"/g, "&quot;")}"` : "";

  return `${dot(post.link)}[${label}](${post.link}${hover})&ensp;*${DATE.format(post.date)}*`;
}

/**
 * The whole list, markers included: the latest posts, then a line for all of them.
 *
 * @param posts - Every post, newest first
 * @returns The block
 */
function block(posts) {
  const all = posts.length === 1 ? "1 post" : `All ${posts.length} posts`;
  const lines = [...posts.slice(0, SHOWN).map(line), `${dot(ALL)}[${all}](${ALL}), or follow them [by RSS](${FEED}).`];

  return `${START}\n${lines.join("\\\n")}\n${END}`;
}

const response = await fetch(FEED, { headers: { "user-agent": "readme-writings" } });

if (!response.ok) {
  throw new Error(`The feed answered ${response.status}`);
}

const posts = parse(await response.text());

if (posts.length === 0) {
  throw new Error("The feed has no posts");
}

const readme = await readFile(FILE, "utf8");
const at = readme.indexOf(START);
const to = readme.indexOf(END);

if (at === -1 || to < at) {
  console.log(`::warning::${FILE} has no writings markers; nothing to update.`);
}
else {
  const next = readme.slice(0, at) + block(posts) + readme.slice(to + END.length);

  if (next === readme) {
    console.log("Writings are up to date.");
  }
  else {
    await writeFile(FILE, next);
    console.log(`Writings updated: ${posts.length} posts, showing ${Math.min(SHOWN, posts.length)}.`);
  }
}
