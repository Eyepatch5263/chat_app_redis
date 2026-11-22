// Timestamps are persisted by Redis as millisecond numbers and may arrive as strings.
export const getReadableTime = (timeStamp: Date | number | string) => {
    const date = timeStamp instanceof Date ? timeStamp : new Date(timeStamp);

    // Extract and format the time part
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    const readableTime = `${hours}:${minutes}`;
    return readableTime
}
