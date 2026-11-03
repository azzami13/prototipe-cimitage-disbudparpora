export default function SearchBar() {
  return (
    <div className="w-full max-w-2xl">
      <div
        className="
          flex items-center
          bg-slate-50
          rounded-full
          border border-neutral-300
          shadow-[0px_10px_16px_9px_rgba(0,0,0,0.06)]
          p-2
        "
      >
        <input
          type="text"
          placeholder="Jelajahi situs wisata"
          className="
            flex-1
            bg-transparent
            px-5
            py-3
            outline-none
            text-sm
            md:text-base
          "
        />

        <button
          className="
            h-11 w-11
            rounded-full
            bg-sky-400
            text-white
            flex
            items-center
            justify-center
            shrink-0
          "
        >
          <img
            src="https://img.icons8.com/?size=100&id=7695&format=png&color=FFFFFF"
            alt="Search"
            className="h-6 w-6"
          />
        </button>
      </div>
    </div>
  );
}