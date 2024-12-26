const ChatList = ({ chats, handleChatClick }) => (
    <div className="p-4 w-80 overflow-y-auto bg-slate-600">
      <h2 className="text-xl font-semibold mb-4 text-slate-200">Chats</h2>
      <ul className="space-y-2">
      {Object.entries(chats).map(([contact, messages]) => (
          <li
            key={contact}
            className="p-2 border rounded-md flex items-center cursor-pointer hover:bg-gray-200 "
            onClick={() => handleChatClick(contact)}
          >
            <div className="rounded-full w-10 h-10 mr-3"></div>
            <div>
              <div className="font-bold">{contact}</div>
              <div className="text-sm text-gray-100 hover:text-black">{messages[messages.length - 1].text}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )

export default ChatList