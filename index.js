const { Telegraf } = require('telegraf');
const axios = require('axios');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

const vfApiUrl = 'https://general-runtime.voiceflow.com/state/user';
const vfVersionAlias = 'production'; // development or production
const vfUserId = 'kl_telegram_test_001';
const vfApiKey = process.env.VF_API_KEY;

/* TODO: Contribute and use sample-api coffee.json
    coffee.json source: https://github.com/jermbo/SampleAPIs/blob/main/server/api/coffee.json */
const coffeeDrinks = require('./coffee.json');
const hotCoffees = coffeeDrinks.hot;
const icedCoffees = coffeeDrinks.iced;


/* ----- Interact with Telegraf / Telegram ----- */
async function sendTelegramMessage(ctx, msg) {
    console.log(`Started sendTelegramMessage() ...`);
    await ctx.reply(msg);
}


/* ----- Helper functions ----- */
// createSessionID example source: https://replit.com/@niko-voiceflow/voiceflow-slackbot?v=1#index.js
function createVFSessionID() {
    // Random Number Generator
    var randomNo = Math.floor(Math.random() * 1000 + 1);
    // get Timestamp
    var timestamp = Date.now();
    // get Day
    var date = new Date();
    var weekday = new Array(7);
    weekday[0] = 'Sunday';
    weekday[1] = 'Monday';
    weekday[2] = 'Tuesday';
    weekday[3] = 'Wednesday';
    weekday[4] = 'Thursday';
    weekday[5] = 'Friday';
    weekday[6] = 'Saturday';
    var day = weekday[date.getDay()];
    // Join random number+day+timestamp
    var session_id = randomNo + day + timestamp;
    return session_id;
}

function getRandomNumber(max) {
    console.log(`Started getRandomNumber() ...`);
    return Math.floor(Math.random() * max);
}

function getRandomCoffee(hotOrIced) {
    console.log(`Started getRandomCoffee() ...`);
    if (hotOrIced === 'iced') {
        return icedCoffees[getRandomNumber(icedCoffees.length + 1)];
    }
    return hotCoffees[getRandomNumber(hotCoffees.length + 1)];
}

async function processVFResponse(ctx, response) {
    console.log(`Started processVFResponse() ...`);

    for (const trace of response.data) {
        console.log(trace);
        switch (trace.type) {
            case 'text': {
                await sendTelegramMessage(ctx, trace.payload.message);
                break;
            }

            /* Get Random Coffee use cases:
                - Get state using /interact */
            case 'Get random coffee': {
                let hotOrIced = await fetchVFState();
                // let hotOrIced = trace.payload;   // Quicker method to retrieve the Custom Aciton payload
                let { title, description } = getRandomCoffee(hotOrIced);
                await sendTelegramMessage(ctx, `${title}: ${description}`);
                break;
            }

            /* Test Custom Action use cases:
                - Get the Custom Action payload using /interact
                - Update variables using /interact
                - Update Custom Action action path */
            case 'Test Custom Action': {
                console.log(`Reached 'Test Custom Action'. Payload below ...`);
                let payload = JSON.parse(trace.payload);
                console.log(payload.test_message);
                await updateVFVariables({
                    test_message: "Got your message. Yup, this is a test!"
                });
                // TODO: move interactWithVF to updateVFVariables()
                await interactWithVF(ctx, {
                    "action": { "type": "success" }
                });
                // await sendTelegramMessage(ctx, `${payload.test_message}`);
                break;
            }

            /* Email Handoff use cases:
                - Get the Custom Action payload using /interact
                - Save transcript using /transcripts [API endpoint TBC]
                - Get transcript using /transcripts [API endpoint TBC]
                - Send email using a 3rd party API
                - Update Custom Action action path (in this case either 'success' or 'failure') */
            case 'Email Handoff': {
                console.log(`Reached 'Email Handoff' ...`);
                // TODO: saveVFTranscript()
                // TODO: getVFTranscript() and return formatted transcript to be passed to sendEmail()
                // TODO: sendEmail()
                await interactWithVF(ctx, {
                    "action": { "type": "success" }
                });
                break;
            }

            // Other VF step/node types include:
            // case 'speak': 
            // case 'visual': 
            // case 'choice': 

            // TODO: add call to https://api.voiceflow.com/v2/transcripts to save the transcript;
            // see the Discord bot for an example: https://replit.com/@niko-voiceflow/voiceflow-discord?v=1#utils/dialogapi.js
            case 'end': {
                await sendTelegramMessage(ctx, `Conversation has ended.`);
                break;
            }
            default: {
                console.log(`Type is not text. See trace below ...`);
                console.log(trace);
                break;
            }
        }
    }

    // const textMsgArray = response.data.reduce((texts, trace) => {
    //     if (trace.type === 'text') {
    //         texts.push(trace.payload.message);
    //     }
    //     return texts;
    // }, []);
    // textMsgArray.forEach(msg => {
    //     await sendTelegramMessage(ctx, msg);
    // });
}


/* ----- Interact with Voiceflow APIs ----- */

/* TODO: saveVFTranscript() when the following Custom Actions are detected
    1) Handoff to Agent
    2) End Conversation */
async function saveVFTranscript(userId) {
    console.log(`Starting saveVFTranscript() ...`)
}

// TODO: getVFTranscript when a 'Handff to Agent' Custom Action is detected
async function getVFTranscript() {
    console.log(`Starting getVFTranscript() ...`)
}

async function fetchVFState() {
    console.log(`Started fetchVFState() ...`);

    const config = {
        method: 'get',
        url: `https://general-runtime.voiceflow.com/state/user/${vfUserId}`,
        headers: {
            'versionID': vfVersionAlias,
            'Content-Type': 'application/json',
            'Authorization': vfApiKey
        }
    };

    return await axios.request(config)
        .then((response) => {
            console.log(`response.status: ${response.status}`);
            return response.data.variables.type;
        })
        .catch((error) => {
            console.log(`Error encountered with VF Dialog API ...`);
            console.log(error);
        });
}

async function updateVFVariables(data) {
    console.log(`Started updateVFVariables() ...`);

    const config = {
        method: 'patch',
        url: `https://general-runtime.voiceflow.com/state/user/${vfUserId}/variables`,
        headers: {
            'versionID': vfVersionAlias,
            'Content-Type': 'application/json',
            'Authorization': vfApiKey
        },
        data: data
    };

    return await axios.request(config)
        .then((response) => {
            console.log(`response.status: ${response.status}`);
            console.log(`response.data ...`);
            console.log(response.data);
        })
        .catch((error) => {
            console.log(error);
        });
}

// TODO: add createVFSessionID() for save and get VF transcript use cases
async function launchVFConvo(ctx) {
    console.log(`Started launchVFConvo() ...`);
    const config = {
        method: 'post',
        url: `${vfApiUrl}/${vfUserId}/interact`,
        headers: {
            'versionID': vfVersionAlias,
            'Content-Type': 'application/json',
            'Authorization': vfApiKey
        },
        data: {
            "action": {
                "type": "launch"
            }
        }
    };

    try {
        const response = await axios.request(config);
        if (response.data) {
            processVFResponse(ctx, response);
        } else {
            await sendTelegramMessage(ctx, `Encountered an error with Voiceflow's Dialog API. Please try again.`);
        }
    } catch (error) {
        console.log(`Error encountered ...`);
        console.log(error);
        await sendTelegramMessage(ctx, `Encountered an error with Voiceflow's Dialog API. Please try again.`);
    }

};

// TODO: update to handle VF intent and launch actions
async function interactWithVF(ctx, payload) {
    console.log(`Started interactWithVF() ...`);
    const config = {
        method: 'post',
        url: `${vfApiUrl}/${vfUserId}/interact`,
        headers: {
            'versionID': vfVersionAlias,
            'Content-Type': 'application/json',
            'Authorization': vfApiKey
        },
        data: {
            action: {
                type: 'text',
                payload: `${payload}`
            }
        }
    };

    try {
        const response = await axios.request(config);
        if (response.data) {
            processVFResponse(ctx, response);
        } else {
            await sendTelegramMessage(ctx, `Encountered an error with Voiceflow's Dialog API. Please try again.`);
        }
    } catch (error) {
        console.log(`Error encountered ...`);
        console.log(error);
        await sendTelegramMessage(ctx, `Encountered an error with Voiceflow's Dialog API. Please try again.`);
    }
}


/* ----- main function ----- */

function main() {
    bot.start((ctx) => {
        launchVFConvo(ctx);
    });
    bot.on('text', (ctx) => {
        interactWithVF(ctx, ctx.message.text);
    })
    bot.launch();
}

main();