import { format } from 'date-fns'

const ChatList = ({ chats, handleChatClick, selectedChat }) => { 
    
  return (
    <div 
      className="p-4 w-80 overflow-y-auto bg-slate-600">
        <h2 className="text-xl font-semibold mb-4 text-slate-200">Chats</h2>
        <ul className="space-y-2">
          {chats.map(chat => (
            <li 
              key={chat.remoteJid}
              onClick={() => handleChatClick(chat.remoteJid)}
              className={`p-2 rounded-md cursor-pointer mb-2 hover:bg-slate-500 ${
                chat.remoteJid === selectedChat ? 'bg-gray-700' : 'bg-gray-900' 
              }`}
              
            >
              
              <div className="flex justify-between items-center">
                <p className="text-slate-200 font-semibold truncate">{chat.remoteJid}</p>
                {chat.messageTimestamp && (
                  <span className="text-xs text-gray-400">
                    {format(new Date(chat.messageTimestamp), 'HH:mm')}
                  </span>
                )}
              </div>
              {chat.message && (
                <p className="text-sm text-gray-300 truncate mt-1">{chat.message}</p>
              )}

            </li>
          ))}
          
        </ul>
    </div>
  );
};

export default ChatList;
