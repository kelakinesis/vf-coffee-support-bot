const { Telegraf } = require('telegraf');
const axios = require('axios');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

const vfGeneralRuntime = process.env.VOICEFLOW_RUNTIME_ENDPOINT;
const versionAlias = 'production'; // development or production
const userId = 'kl_telegram_test_001';
const apiKey = process.env.VF_API_KEY;
const projectId = process.env.VF_PROJECT_ID;

let vfSessionId;

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
function createSessionId() {
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
    // console.log(`response.data ...`);
    // console.log(response.data);

    for (const trace of response.data) {
        // console.log(trace);
        switch (trace.type) {
            case 'text': {
                await sendTelegramMessage(ctx, trace.payload.message);
                break;
            }

            /* Get Random Coffee use cases:
                - Get state
                - Update variables and action path */
            case 'Get Random Coffee': {
                let hotOrIced = await fetchState();
                // let hotOrIced = trace.payload;   // Quicker method to retrieve the Custom Aciton payload
                let { title, description } = getRandomCoffee(hotOrIced);
                await updateVariables(ctx, {
                    recommended_coffee: `${title}: ${description}`
                });
                break;
            }

            /* Test Custom Action use cases:
                - Get the Custom Action payload
                - Update variables and action path */
            case 'Test Custom Action': {
                console.log(`Reached 'Test Custom Action'. Payload below ...`);
                console.log(JSON.parse(trace.payload));
                await updateVariables(ctx, {
                    test_message: "Yup, this is a test!"
                });
                break;
            }

            /* Email Handoff use cases:
                - Get the Custom Action payload
                - Save transcript [API endpoint TBC]
                - Get transcript [API endpoint TBC]
                - Send email using a 3rd party API
                - Update Custom Action action path (i.e. 'success') */
            case 'Email Handoff': {
                console.log(`Reached 'Email Handoff' ...`);
                let transcriptId = await saveTranscript();
                console.log(`transcriptId: ${transcriptId}`);
                let transcript = await getTranscript(transcriptId);
                console.log(`VF Transcript ...`);
                console.log(transcript);
                // TODO: build a sendEmail() function and send action path

                await interact(ctx, {
                    "action": { "type": "success" }
                });
                break;
            }

            // Other VF step/node types include:
            // case 'speak': 
            // case 'visual': 
            // case 'choice': 

            // TODO: add saveTranscript()
            case 'end': {
                let transcriptId = await saveTranscript();
                console.log(`transcriptId: ${transcriptId}`);
                let transcript = await getTranscript(transcriptId);
                console.log(`VF Transcript ...`);
                console.log(transcript);
                await sendTelegramMessage(ctx, `Conversation has ended.`);
                return false;
            }
        }
    }
}


/* ----- Interact with Voiceflow APIs ----- */

async function launchConvo(ctx) {
    // vfSessionId = `${versionAlias}.${createSessionId()}`;
    vfSessionId = createSessionId();
    console.log(`Started launchVFConvo(). Voiceflow sessionID is: ${vfSessionId}`);

    const config = {
        method: 'post',
        url: `${vfGeneralRuntime}/state/user/${userId}/interact`,
        headers: {
            versionID: versionAlias,
            Authorization: apiKey,
            'Content-Type': 'application/json'
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
async function interact(ctx, payload) {
    console.log(`Started interact() ...`);
    const config = {
        method: 'post',
        url: `${vfGeneralRuntime}/state/user/${userId}/interact`,
        headers: {
            versionID: versionAlias,
            Authorization: apiKey,
            'Content-Type': 'application/json'
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

/* TODO: follow-up on /transcripts documentation */
async function saveTranscript() {
    console.log(`Starting saveTranscript() ...`)

    const config = {
        method: 'put',
        url: 'https://api.voiceflow.com/v2/transcripts',
        headers: {
            Authorization: apiKey,
        },
        data: {
            browser: "Telegram",
            device: "desktop",
            os: "macOS",
            sessionID: vfSessionId,
            unread: true,
            versionID: versionAlias,
            projectID: projectId,
            user: {
                name: userId
            }
        }
    }

    try {
        const response = await axios.request(config);
        if (response.data) {
            console.log(`response.data ...`);
            console.log(response.data);
            sessionID = createSessionId();
            return response.data._id;
        } else {
            console.log(`Error encountered ...`);
        }
    } catch (error) {
        console.log(`Error encountered ...`);
        console.log(error.response.data);
    }
}

// TODO: getTranscript when a 'Handff to Agent' Custom Action is detected
async function getTranscript(transcriptId) {
    console.log(`Starting getTranscript() ...`);

    const config = {
        method: 'get',
        url: `https://api.voiceflow.com/v2/transcripts/${projectId}/${transcriptId}`,
        headers: {
            Authorization: apiKey,
            'Content-Type': 'application/json'
        }
    }

    try {
        const response = await axios.request(config);
        if (response.data) {
            return response.data;
        } else {
            console.log(`Error encountered ...`);
        }
    } catch (error) {
        console.log(`Error encountered ...`);
        console.log(error.response.data);
    }
}

async function fetchState() {
    console.log(`Started fetchState() ...`);

    const config = {
        method: 'get',
        url: `https://general-runtime.voiceflow.com/state/user/${userId}`,
        headers: {
            versionID: versionAlias,
            Authorization: apiKey,
            'Content-Type': 'application/json'
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

async function updateVariables(ctx, data) {
    console.log(`Started updateVariables() ...`);

    const config = {
        method: 'patch',
        url: `https://general-runtime.voiceflow.com/state/user/${userId}/variables`,
        headers: {
            versionID: versionAlias,
            Authorization: apiKey,
            'Content-Type': 'application/json'
        },
        data: data
    };

    try {
        const response = await axios.request(config);
        if (response.data) {
            await interact(ctx, {
                "action": { "type": "success" }
            });
        } else {
            await interact(ctx, {
                "action": { "type": "failure" }
            });
            console.log(`ERROR: Encountered an error with Voiceflow's Dialog API. Please try again.`);
        }
    } catch (error) {
        console.log(`Error encountered ...`);
        console.log(error);
    }
}


/* ----- main function ----- */

function main() {
    // On Telegram bot start command, launch a Voiceflow conversation
    bot.start((ctx) => {
        launchConvo(ctx);
    });
    bot.on('text', (ctx) => {
        interact(ctx, ctx.message.text);
    })
    bot.launch();
}

main();