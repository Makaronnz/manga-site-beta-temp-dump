// src/app/credits/page.tsx
export const dynamic = "force-static";

export default function CreditsPage() {
  return (
    <div className="container mx-auto px-4 md:px-6 py-10">
      <h1 className="text-3xl font-bold mb-6">Credits</h1>
      <p className="opacity-80 mb-8">
        Thanks to the manga/comic sources and communities that make reading possible.
      </p>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3">Comics info</h2>
        <ul className="list-disc ml-6 space-y-1">
          <li><a className="underline" href="https://mangadex.org/" target="_blank" rel="noreferrer">mangadex.org</a></li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3">Additional info</h2>
        <ul className="list-disc ml-6 space-y-1">
          <li><a className="underline" href="https://www.mangaupdates.com/" target="_blank" rel="noreferrer">mangaupdates.com</a></li>
          <li><a className="underline" href="https://myanimelist.net/" target="_blank" rel="noreferrer">myanimelist.net</a></li>
          <li><a className="underline" href="https://anilist.co/" target="_blank" rel="noreferrer">anilist.co</a></li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3">Image links</h2>
        <ul className="list-disc ml-6 space-y-1">
          <li><a className="underline" href="https://mangadex.org/" target="_blank" rel="noreferrer">MangaDex</a></li>
          <li><a className="underline" href="https://bato.to/" target="_blank" rel="noreferrer">bato.to</a></li>
          <li><a className="underline" href="https://mangasee123.com/" target="_blank" rel="noreferrer">Mangasee123.com</a></li>
        </ul>
      </section>

      <p className="opacity-70">
        And other translation/scanlation groups. MakaronComiks is a reader UI that references public
        metadata; content belongs to their respective owners.
      </p>
    </div>
  );
}
