module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './android',
        packageImportPath: 'import com.phonescan.reactnative.PhoneScanPackage;',
        packageInstance: 'new PhoneScanPackage()',
      },
      ios: null,
    },
  },
};
