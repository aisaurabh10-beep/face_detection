export const useTour = () => {

    const startTour = async (steps: any[]) => {
        // Dynamically import to avoid SSR issues
        const { driver } = await import('driver.js');

        const driverObj = driver({
            showProgress: true,
            animate: true,
            smoothScroll: true,
            stagePadding: 10,
            stageRadius: 10,
            overlayOpacity: 0.65,
            allowClose: true,
            overlayClickBehavior: () => { },
            allowKeyboardControl: true,
            popoverClass: 'driverjs-theme',
            showButtons: ['next', 'previous', 'close'],
            progressText: 'Step {{current}} of {{total}}',
            nextBtnText: 'Next >',
            prevBtnText: '< Previous',
            doneBtnText: 'Got it!',
            steps,
            onDestroyed: () => {
                // Mark tour as complete for this session
                sessionStorage.setItem('tour_completed', 'true');
            }
        });

        driverObj.drive();
    };

    return { startTour };
};