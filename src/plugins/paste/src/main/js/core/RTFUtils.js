define('tinymce.plugins.paste.core.RTFUtils', [], function () {

  function hexToBase64(hexstring) {
    return window.btoa(hexstring.match(/\w{2}/g).map(function (a) {
      return String.fromCharCode(parseInt(a, 16));
    }).join(''));
  }

  function resolveImageFormat(rtfCtrlWord) {
    switch (rtfCtrlWord) {
      case '\\emfblip': return 'emf';
      case '\\pngblip': return 'png';
      case '\\jpegblip': return 'jpg';
      case '\\macpict': return 'pct';
      case '\\dibitmap': // Not supported yet. Falling through!
      case '\\wbitmap':  // Not supported yet. Falling through!
      default: return 'unknown';
    }
  }

  function getImagesFromRtf(rtfData) {
    var unknownFormat = 'unknown';
    // '\pmmetafile' and '\wmetafile' are not included because they're used by MS Word to add
    // redundant copies of the same images
    var imgFormats = ['\\emfblip', '\\pngblip', '\\jpegblip', '\\macpict', '\\dibitmap', '\\wbitmap'];

    // The control word '\listpicture' defines images to be used as list 'bullets', not supported by now
    var listPictureBegIdx = rtfData.indexOf('{\\*\\listpicture');
    var listPictureEndIdx = listPictureBegIdx;
    if (listPictureBegIdx != -1) {
      var listPictureGrpInfo = fetchCurrentGroupInfo(rtfData, listPictureBegIdx);
      if (listPictureGrpInfo) {
        listPictureEndIdx = listPictureGrpInfo.grpEnd;
      }
    }
    var pictPat = '{\\pict';
    var imageIdx = rtfData.indexOf(pictPat);
    var images = [];

    while (imageIdx !== -1) {
      var imageInfo = fetchCurrentGroupInfo(rtfData, imageIdx);

      var imageFormat = imageInfo.ctrlWords.find(function (x) {
        return imgFormats.indexOf(x) != -1;
      }) || unknownFormat;

      var imageHex = imageInfo.data;

      if ((imageFormat != unknownFormat) &&
          ((imageIdx < listPictureBegIdx) || (imageIdx > listPictureEndIdx))) {
        images.push({ format: resolveImageFormat(imageFormat),
          base64data: hexToBase64(imageHex) });
      }
      imageIdx = rtfData.indexOf(pictPat, imageIdx + imageHex.length);
    }
    return images;
  }

  function fetchCurrentGroupInfo(rtfData, location) {
    var rtfGroupData = rtfData.substring(location);
    var groupLevel = 0;
    var ctrlWordRegexp = /\\\w+|\W[0-9|a-f]|{|}/g;
    var dataBeg = null;
    var match;
    var ctrlWords = [];

    do {
      match = ctrlWordRegexp.exec(rtfGroupData);
      if (match) {
        if (match[0][0] == '{') {
          ++groupLevel;
        } else if (match[0][0] == '}') {
          --groupLevel;
          if (match[0].length > 1 && groupLevel == 1) {
            dataBeg = match.index + 1;
          }
        } else if (match[0][0] == '\\' && groupLevel == 1) {
          ctrlWords.push(match[0]);
        } else if (match[0][0] != '\\' && groupLevel == 1 && match[0][0] != '-') {
          dataBeg = match.index;
        }
      }
    } while (match && dataBeg == null && groupLevel > 0);

    if (!match) {
      /*eslint no-console:0 */
      if (typeof console !== 'undefined' && console.error) {
        console.error('Error');
      }
      return {
        ctrlWords: ctrlWords,
        data: '',
        grpEnd: location
      };
    }

    var grpEnd = match.index;
    var fetchedData;
    if (dataBeg != null) {
      var dataEnd = rtfGroupData.indexOf('}', dataBeg) - 1;
      var rawData = rtfGroupData.substring(dataBeg, dataEnd);
      fetchedData = rawData.replace(/\r|\n/g, '');
    }
    return {
      ctrlWords: ctrlWords,
      data: fetchedData,
      grpEnd: grpEnd + location
    };
  }

  return {
    getImagesFromRtf: getImagesFromRtf,
    fetchCurrentGroupInfo: fetchCurrentGroupInfo
  };
});
