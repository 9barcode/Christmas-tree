// Calendar-only test clock. Never changes the device clock or production state.
export function nextTestDate(date){const d=new Date(`${date}T00:00:00Z`);if(!Number.isFinite(d.getTime()))throw Error('Invalid test date');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);}
