import {createPhoneScanClient, type PhoneScanClient} from '@alphaseneca/react-native-phonescan';

export const appContainer = createPhoneScanClient();
export type AppContainer = PhoneScanClient;
