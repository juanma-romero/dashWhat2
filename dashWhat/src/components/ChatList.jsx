import {format} from 'date-fns'
import {isObject} from 'lodash'

const ChatList = ({ chats, handleChatClick }) => {
    console.log('desde chatlist',chats)
    return (
        <div className="p-4 w-80 overflow-y-auto bg-slate-600">
            <h2 className="text-xl font-semibold mb-4 text-slate-200">Chats</h2>
            <ul className="space-y-2">
                <p>1</p>
                <p>2</p>
                <p>3</p>
            </ul>
            
        </div>
    )
};

export default ChatList