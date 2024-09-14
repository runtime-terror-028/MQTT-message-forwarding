const mqtt = require('mqtt');
const os = require('os');
const express = require('express');
const app = express();

const PORT = 7000;

const TOPIC = [
    "water-consumption-data",
    "device-heartbeat-info",
    "latest-firmware-version",
    "update-initial-value/#",
    "maintenace/#"
];

const MAC_ADDRESS = getServerMacAddress();
const SIDE_ID = convertMacToSiteId(MAC_ADDRESS);

//--|Local MQTT|--
const LOCAL_CLIENT_ID = MAC_ADDRESS;
const LOCAL_MQTT_USERNAME = "nuez";
const LOCAL_MQTT_PASSWORD = "emqx@nuez";
const LOCAL_MQTT_IP = "mqtt://localhost:1883"

//--|Target MQTT|--
const TARGET_CLIENT_ID = "mqttx_1ad589f0";
const TARGET_MQTT_USERNAME = "nuez";
const TARGET_MQTT_PASSWORD = "emqx@nuez";
const TARGET_MQTT_IP = "mqtt://broker.emqx.io:1883"


// MQTT Options and Client Setup
const LOCAL_MQTT_OPTIONS = {
    clientId: LOCAL_CLIENT_ID,
    username: LOCAL_MQTT_USERNAME,
    password: LOCAL_MQTT_PASSWORD,
    clean: true,
};
const TARGET_MQTT_OPTIONS = {
    clientId: TARGET_CLIENT_ID,
    username: TARGET_MQTT_USERNAME,
    password: TARGET_MQTT_PASSWORD,
    clean: true,
};

// MQTT connection
const local_client = mqtt.connect(LOCAL_MQTT_IP, LOCAL_MQTT_OPTIONS);
const target_client = mqtt.connect(TARGET_MQTT_IP, TARGET_MQTT_OPTIONS);

// Error Handling for MQTT Client
local_client.on('error', (error) => {
    console.error('MQTT Local Client Error:', error);
});
// Error Handling for MQTT Client
target_client.on('error', (error) => {
    console.error('MQTT Target Client Error:', error);
});

//--|MAC Address|--
function getServerMacAddress() {
    const interfaces = os.networkInterfaces();
    for (const interfaceName in interfaces) {
        for (const iface of interfaces[interfaceName]) {
            if (!iface.internal && iface.mac) {
                return iface.mac;
            }
        }
    }
    return null;
};

//--|Convert MAC Address to site ID|--
function convertMacToSiteId(mac) {
    const mappedSequence = mapHexToSequence(mac.replace(/:/g, ''));
    return `SITE::${formatSequence(mappedSequence)}`;
};

//--|Helper code|--
function mapHexToSequence(mac) {
    const hexToSeqMap = {
        '0': 'A', '1': 'B', '2': 'C', '3': 'D', '4': 'E', '5': 'F',
        '6': 'G', '7': 'H', '8': 'I', '9': 'J', 'a': 'K', 'b': 'L',
        'c': 'M', 'd': 'N', 'e': 'O', 'f': 'P'
    };
    return mac.split('').map(char => hexToSeqMap[char.toLowerCase()] || char).join('');
};

//--|Also Helper code|--
function formatSequence(sequence) {
    return sequence.match(/.{1,3}/g).join(':');
};


//--|Subscribe to local MQTT|--
local_client.on('connect', () => {
    console.log('Connected to Local MQTT Broker');
    local_client.subscribe(TOPIC, (error) => {
        if (error) {
            console.error('Failed to subscribe (Local):', error);
        } else {
            console.log('Subscribed to topic (Local):', TOPIC);
        }
    });
});

//--|Receive message from local MQTT => publish it to target MQTT|--
local_client.on('message', async (topic, message) => {
    const messageString = message.toString();
    const data = await JSON.parse(messageString);
    data.site_id = SIDE_ID;
    //--|publish with added site ID|--
    publish(topic, data);
});

//--|Publish to Target MQTT|--
function publish(topic, payload) {
    target_client.publish(topic, JSON.stringify(payload), (error) => {
        if (error) {
            console.error('Publish error:', error);
        } else {
            console.log(`Published to topic (Target) '${topic}': ${JSON.stringify(payload)}`);
            // console.log(`Published to topic (Target) '${topic}'`);
        };
    });
};



app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
