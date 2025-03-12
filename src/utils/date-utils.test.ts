import { DateToHhMmSsString } from "./date-utils";

describe('DateToHhMmSsString', () => {

    test('It should return a string of the Date in format HH:MM:SS', () => {
        const mockDate = new Date('1999-12-13T14:20:50')

        expect(DateToHhMmSsString(mockDate)).toBe("14:20:50")
    })

    test('It should pad Hours, minutes and seconds', () => {
        const mockDate = new Date('1999-12-13T04:02:05')

        expect(DateToHhMmSsString(mockDate)).toBe("04:02:05")
    })
})