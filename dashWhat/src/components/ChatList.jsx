import { format } from 'date-fns' 
import { ORDER_STATUS_COLORS } from '../utils/orderStatus.js'

const ChatList = ({ chats, handleChatClick, selectedChat }) => {  
  

  return (
    <div 
      className="p-4 w-1/4 overflow-y-auto bg-slate-600">
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
                <p className="text-slate-200 font-semibold truncate">
                  {chat.contact ? `${chat.contact.firstName} ${chat.contact.lastName}` : chat.remoteJid}
                </p>
                {chat.messageTimestamp && (
                  <span className="text-xs text-gray-400">
                    {format(new Date(chat.messageTimestamp), 'HH:mm')}
                  </span>
                )}
              </div>
              {chat.message && (
              <div className="flex justify-between items-center mt-1">
              <p className="text-sm text-gray-300 truncate">{chat.message}</p>
              {/* Badge for last order status */}
              <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ml-2 ${
                ORDER_STATUS_COLORS[chat.lastOrderStatus] || 'bg-gray-500 text-white'
              }`}>
                {chat.lastOrderStatus}
              </span>
              </div>
            )}
            </li>
          ))}
          
        </ul>
    </div>
  );
};

export default ChatList;
