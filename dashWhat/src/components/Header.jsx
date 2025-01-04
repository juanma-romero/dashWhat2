const Header = () => (
    <div className="flex justify-between items-center bg-slate-800 p-4">
      <input
        type="text"
        placeholder="Buscar..."
        className="text-gray-600 p-2 rounded-md w-80"
      />
      <div className="flex items-center">
        <div className="text-sm mr-4 text-slate-400">Voraz</div>
        <div className="rounded-full bg-red-500 w-8 h-8"></div>
      </div>
    </div>
  )

  export default Header