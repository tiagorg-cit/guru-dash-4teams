export function generateMonthYearDateKey(originalDate:Date): string {
    const month = extractMonthOfDate(originalDate);
    const year = extractYearOfDate(originalDate);
    const yearMonthDate = year.concat('-').concat(month);
    return yearMonthDate;
}

function extractMonthOfDate(date:Date): string{
    const month = date?.getMonth() + 1;
    return month < 10 ? "0" + month : month?.toString();  
}

function extractYearOfDate(date:Date): string {
    return date?.getFullYear()?.toString();
}