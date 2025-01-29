import fetch from 'node-fetch';
import qrcode from 'qrcode-terminal'; 
import pkg from 'whatsapp-web.js';
import express from 'express';
import path from 'path';
import http from 'http';
import { Server } from 'socket.io'; 

const { Client, LocalAuth} = pkg;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling'] 
});

const PORT = process.env.PORT || 5000; 
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

app.use(express.json());
app.use(express.static('public')); 

app.post('/sendMessages', async (req, res) => {
    const { number, message } = req.body;  
    if (!number || !message) {
        return res.status(400).send({ error: 'Number and message are required' });
    }

    try {
        await sendMessageToNumber(number, message);
        res.status(200).send({ result: 'Message sent' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).send({ error: 'Failed to send message' });
    }
});


const client = new Client(
      
         { puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] } });

app.get('/qr', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    io.emit('qr', qr);  
});


let isMessageListenerSet = false; 

client.on('ready', () => {
    console.log('Client is ready!');
    if (!isMessageListenerSet) {
        setupMessageListener(); 
        isMessageListenerSet = true; 
    }
});

 
function setupMessageListener() {
  
    client.on('message_create', async (message) => {



        if (message.from === client.info.wid._serialized) {
            return; 
        }

        const chat = await message.getChat();    

            
        const messageBody = message.body;     
        const sender = message.from;
        const senderId = message.author;           

        if (!chat.isGroup){
            console.log("Ini chat Personal");
            console.log(`Received message: ${messageBody}`); 
            
            if (messageBody.startsWith("hitung") || messageBody.startsWith("Hitung") || messageBody.startsWith("HITUNG")) {
                const expression = messageBody.slice(7).trim();  
                const result = calculateExpression(expression);
                const formatMessage = formatNumbersInString(expression);
                await sendMessageToNumber(sender, `Hasil: ${formatMessage} = ${result}`);
                return; 
            }


            return
        }

      
        console.log(`Received message: ${messageBody}`);   

  
                   
        const messagereact = await fetchReact();      
 
            if (messagereact && messagereact.some(i => messageBody.toLowerCase() .includes(i.toLowerCase())) && chat.isGroup) {
                try {  

                    const contact = await client.getContactById(senderId);                 
                    const myWa = await fetchNumber()

                    // if (!myWa.includes(contact.number)) {

                    //     sendMessageToNumber(sender, "Maaf, anda bukan Admin")
                    //     return
                    // }    



                    await message.react('👍');  
                    console.log(`Reacted to message from ${sender} with 👍`);
                } catch (error) {
                    console.error(`Failed to react to message: ${error}`);
                }
                return;
            }    
               
                const tag = await fetchMessages();     
              
             
                if (tag && tag.some(s => messageBody.toLowerCase().includes(s.toLowerCase())) && chat.isGroup) {
                 
                    try {

                        const contact = await client.getContactById(senderId);                 
                        // const myWa = await fetchNumber()
                        // if (!myWa.includes(contact.number)) {

                        //     sendMessageToNumber(sender, "Maaf, anda bukan Admin")
                        //     return
                        // }    


                        const participants = await chat.participants;
                        console.log(participants);  
                        const mentions = participants.map(participant => {
                            return {
                                id: participant.id._serialized,
                                notify: participant.notify  || participant.id.user
                            };
                        });              
                        const mentionMessage = `@${mentions.map(m => m.notify).join(', @')}`;
                        console.log(`Mentioning participants: ${JSON.stringify(mentions)}`);
                        await sendMessageToNumber(sender, mentionMessage); 
                    } catch (error) {
                        console.error(`Failed to tag: ${error}`);
                    }
                    return;  
                }
                            
        if (messageBody.startsWith("hitung") || messageBody.startsWith("Hitung") || messageBody.startsWith("HITUNG")) {
            const expression = messageBody.slice(7).trim();  
            const result = calculateExpression(expression);
            const formatMessage = formatNumbersInString(expression);
            await sendMessageToNumber(sender, `Hasil: ${formatMessage} = ${result}`);
            return; 
        }

     
        if (message.type === 'chat' && sender !== 'status@broadcast' ) {

            // const contact = await client.getContactById(senderId);                 
            // const myWa = await fetchNumber()
            // if (!myWa.includes(contact.number)) {

            //     sendMessageToNumber(sender, "Maaf, anda bukan Admin")
            //     return
            // }

            
            const sender = chat.id._serialized;  
            const groupName = chat.name;             
            console.log(`Received message: ${messageBody}`);
            await logMessageToGoogleSheets(sender, groupName, messageBody);
        }

    });   
   
}
    
    client.on('qr', qr => { 
    qrcode.generate(qr, { small: true });   
    io.emit('qr', qr); 
});

function formatNumbersInString(input) {
    // Regular expression to match numbers
    const numberPattern = /\b\d+\b/g;

    // Function to format the matched number
    const formatNumber = (num) => {
        return num.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    // Replace numbers in the input string with formatted numbers
    const formattedString = input.replace(numberPattern, (match) => formatNumber(match));

    return formattedString;
}


async function fetchReact() {
    try {
        const response = await fetch(`https://script.google.com/macros/s/AKfycbzxLvU0rODVYochtAYzy1lDQ0r9lSX2rwU0bmoKpJiDa-6i-O8V1fh5hpkWYr4dOviE/exec?action=react`);
        const data = await response.json();         

        if (Array.isArray(data.latestMessage)) {            
            return data.latestMessage;  
        } else if (data.latestMessage) {
            return [data.latestMessage]; 
        } else {
            return []; // Return an empty array if no messages found
        }
    } catch (error) {
        console.error('Error fetching the react message:', error);
        return []; // Return an empty array on error
    }
}



 
async function fetchMessages() {
    try {
        const response = await fetch(`https://script.google.com/macros/s/AKfycbzxLvU0rODVYochtAYzy1lDQ0r9lSX2rwU0bmoKpJiDa-6i-O8V1fh5hpkWYr4dOviE/exec?action=tag`);
        const data = await response.json();           
        
        if (Array.isArray(data.allMembers)) {            
            return data.allMembers;   
        } else if (data.allMembers) {
            return [data.allMembers];   
        } else {
            return []; // Return an empty array if no members found
        }
    } catch (error) {
        console.error('Error fetching the message:', error);
        return []; // Return an empty array on error
    }
}




// async function fetchNumber() {
//     try {
//         const response = await fetch(`https://script.google.com/macros/s/AKfycbzxLvU0rODVYochtAYzy1lDQ0r9lSX2rwU0bmoKpJiDa-6i-O8V1fh5hpkWYr4dOviE/exec?action=myNumber`);
//         const data = await response.json();           
        
//         if (Array.isArray(data.myNumber)) {            
//             return data.myNumber;   
//         } else if (data.myNumber) {
//             return [data.myNumber];   
//         } else {
//             return []; // Return an empty array if no members found
//         }
//     } catch (error) {
//         console.error('Error fetching the message:', error);
//         return []; // Return an empty array on error
//     }
// }





function calculateExpression(expression) {
  
    const validExpression = /^[0-9+\-*/().\s%]+$/;  
    expression = expression.replace(/\s*x\s*/g, '*');
    if (!validExpression.test(expression)) {
        return "Invalid expression";
    } 
    expression = expression.replace(/(\d+)%/g, '($1 / 100)');

    try {       
        const result = eval(expression);
        return formatNumber(result); 
    } catch (error) {
        console.error('Error evaluating expression:', error);
        return "Error in calculation";
    }
}

function formatNumber(num) {
    if (isNaN(num)) return "Invalid number";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

 



async function sendMessageToNumber(number, message) { 

    try {
        const chatId = number; 
        await client.sendMessage(chatId, message);
    } catch (error) {
        console.error('Error sending message:', error);
        throw new Error('Failed to send message');
    }
}


 


client.initialize();

client.on('disconnected', async (reason) => {
    console.log('Client was logged out:', reason);
    await client.destroy();
    await client.initialize(); 

  
    client.on('qr', qr => {
        qrcode.generate(qr, { small: true });
        io.emit('qr', qr);  
    });

    client.on('ready', () => {
    console.log('Client is ready!');
    if (!isMessageListenerSet) {
        setupMessageListener(); 
        isMessageListenerSet = true; 
    }
    });


});


async function logMessageToGoogleSheets(sender, groupName, message) {
    const url = 'https://script.google.com/macros/s/AKfycbzxLvU0rODVYochtAYzy1lDQ0r9lSX2rwU0bmoKpJiDa-6i-O8V1fh5hpkWYr4dOviE/exec'; // Replace with your Apps Script URL
    const payload = {
        sender: sender,
        groupName: groupName,
        message: message
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        console.log('Message logged to Google Sheets:', result);
    } catch (error) {
        console.error('Error logging message to Google Sheets:', error);
    }
}
 




