export function generateMonthYearDateKey(originalDate:Date): string {
    const month = extractMonthOfDate(originalDate);
    const year = extractYearOfDate(originalDate);
    const yearMonthDate = year.concat('-').concat(month).concat('-01T00:00:00');
    return yearMonthDate;
}

function extractMonthOfDate(date:Date): string{
    const month = date?.getMonth() + 1;
    return month < 10 ? "0" + month : month?.toString();  
}

function extractYearOfDate(date:Date): string {
    return date?.getFullYear()?.toString();
}

export function getDaysInMonth (yearMonth: string): number {
    const spplitedDate = yearMonth.split("-");
    const year = Number.parseInt(spplitedDate[0]);
    const month = Number.parseInt(spplitedDate[1]);
    return new Date(year, month, 0).getDate();
}
  