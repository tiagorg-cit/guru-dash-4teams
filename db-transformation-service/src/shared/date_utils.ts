export function generateDayMonthYearDateKey(originalDate:Date): string {
    const day = extractDayOfDate(originalDate);
    const month = extractMonthOfDate(originalDate);
    const year = extractYearOfDate(originalDate);
    const yearMonthDate = year.concat('-').concat(month).concat('-').concat(day);
    return yearMonthDate;
}

export function generateMonthYearDateKey(originalDate:Date): string {
    const month = extractMonthOfDate(originalDate);
    const year = extractYearOfDate(originalDate);
    const yearMonthDate = year.concat('-').concat(month).concat('-01T03:00:00');
    return yearMonthDate;
}

function extractDayOfDate(date:Date): string {
    return date?.getDate()?.toString();
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
    const dateKey:Date = new Date(year, month, 0);
    
    const dateNow: Date = new Date();
    if(dateKey.getMonth() === dateNow.getMonth() && dateKey.getFullYear() === dateNow.getFullYear()){
        return dateNow.getDate();
    }

    return dateKey.getDate();
}
  