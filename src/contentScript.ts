import * as Message from './type';
import browser from 'webextension-polyfill';
import {v4 as uuidv4} from 'uuid';

/*
const getSHA256Digest = async (msg:string) => {
  const uint8 = new TextEncoder().encode(msg);
  const digest = await crypto.subtle.digest('SHA-256', uint8);
  return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0')).join('');
};
*/
type ElementTree = {name: string, id:string, class: string[]};

type ElementInfo = {
  [keyof: string]: [ElementTree[], string];
};

const elementMemo:ElementInfo = {};

const classPrefix = 'picpickdl';

const getUniqueElementSelector = (target: Element)=>{
  if (target.classList) {
    for (let i=0; i<target.classList.length; i++) {
      if (target.classList[i].indexOf(classPrefix)===0) {
        return `.${target.classList[i]}`;
      }
    }
  }
  const newUniqueClass = classPrefix + uuidv4();
  target.classList.add(newUniqueClass);
  return `.${newUniqueClass}`;
};

const getNodeTree = (target: Element)=>{
  let x :Element | null = target;
  const domtree:ElementTree[] = [];
  while (x !== null) {
    const classlist = [];
    if (x.classList) {
      for (let i=0; i<x.classList.length; i++) {
        classlist.push(x.classList[i]);
      }
    }
    domtree.unshift({
      name: x.tagName.toLowerCase(),
      id: x.id,
      class: classlist,
    });
    x = x.parentElement;
  }
  return domtree;
};

const tree2Info = (tree: ElementTree[]) =>
  tree.map((x)=>
    x.name +
    (x.class.length === 0 ? '' : '.'+x.class.join('.')) +
    (x.id === '' ? '' : '#'+x.id),
  ).join('>');

const getNodeTreeMemo = (target: Element, str: string): [string, string]=>{
  const selector = getUniqueElementSelector(target);
  if (!elementMemo[selector]) {
    const tree = getNodeTree(target);
    elementMemo[selector] = [tree, tree2Info(tree)];
  }
  return [selector, elementMemo[selector][1]+`>${str}`];
};

const getimginfo = (imgUri: string, base: string )=>{
  if (imgUri.indexOf('data:') == 0) {
    return [imgUri, 'data-uri'];
  }
  const imgTrueUri:string = (new URL(imgUri, base)).toString();
  const filename =
    imgTrueUri.match(/.+\/(.+?)([\?#;].*)?$/)?.[1] || 'anyfile';
  return [imgTrueUri, filename];
};

const getImgList = (document: Document) =>{
  // img
  const imglist = Array.from(document.getElementsByTagName('img'))
      .flatMap((element): [string, string, string][] =>{
        const uri = element.getAttribute('src');
        return ( uri === null ?
          [] :
          [[uri, ...getNodeTreeMemo(element, 'img')]]
        );
      })
      .map(([uri, selector, treeinfo]): [string, Message.PicObj] => {
        const [imgTrueUri, filename] = getimginfo(uri, location.href);
        return [imgTrueUri, {
          uri: imgTrueUri,
          blob: null,
          filesize: null,
          filename: filename,
          selector,
          treeinfo,
        }];
      });
  // css
  const csslist = Array.from(document.querySelectorAll('*'))
      .flatMap((element):[string, Element][]=>{
        const property = getComputedStyle(element).backgroundImage;
        return property ? [[property, element]] : [];
      })
      .flatMap(([property, element]):[string, string, string][]=>{
        const x =
          property.match(
              /((data|https?):)?\/\/[\w!\?/\+\-_~=;\.,\*&@#\$%\(\)'\[\]]+/g);
        return (x===null ?
            [] :
            x.map((uri)=>[uri, ...getNodeTreeMemo(element, 'css')]));
      })
      .map(([uri, selector, treeinfo]): [string, Message.PicObj] => {
        const [imgTrueUri, filename] = getimginfo(uri, location.href);
        return [imgTrueUri, {
          uri: imgTrueUri,
          blob: null,
          filesize: null,
          filename: filename,
          selector,
          treeinfo,
        }];
      });
  // svg
  const svglist = Array.from(document.getElementsByTagName('svg'))
      .flatMap((svgElement): [string, string, string][] => {
        const expressedElmentCnt = Array.from(svgElement.children)
            .filter((x)=>x.tagName !== 'defs').length;
        return ( expressedElmentCnt === 0 ?
        [] :
        [[window.btoa(new XMLSerializer().serializeToString(svgElement)),
          ...getNodeTreeMemo(svgElement, 'svg')]]);
      })
      .map(([base64, selector, treeinfo]): [string, Message.PicObj] => {
        const [imgTrueUri, filename] =
          getimginfo(`data:image/svg+xml;base64,${base64}`, location.href);
        return [imgTrueUri, {
          uri: imgTrueUri,
          blob: null,
          filesize: null,
          filename: filename,
          selector,
          treeinfo,
        }];
      });
  // canvas
  const canvaslist = Array.from(document.getElementsByTagName('canvas'))
      .flatMap((canvasElement):[string, string, string][] =>{
        try {
          const dataURI = canvasElement.toDataURL();
          return dataURI ?
            [[dataURI, ...getNodeTreeMemo(canvasElement, 'canvas')]] :
            [];
        } catch (e) {
          // CROSS-ORIGIN ERROR
          return [];
        }
      })
      .map(([base64URI, selector, treeinfo]): [string, Message.PicObj] => {
        const [imgTrueUri, filename] =
          getimginfo(base64URI, location.href);
        return [imgTrueUri, {
          uri: imgTrueUri,
          blob: null,
          filesize: null,
          filename: filename,
          selector,
          treeinfo,
        }];
      });
  return [...imglist, ...csslist, ...svglist, ...canvaslist];
};


const sendImgList = () => {
  const imglistEntry = [
    // main
    ...getImgList(document),
    // iframe
    ...Array.from(document.getElementsByTagName('iframe'))
        .flatMap((iframeElement) => {
          const win = iframeElement.contentWindow;
          try {
            return (win === null ? [] : [win.document]);
          } catch (e) {
            // CROSS-ORIGIN ERROR
            return [];
          }
        })
        .flatMap((document) => getImgList(document)),
  ];

  const message: Message.MessagePicList = {
    command: 'putimglist',
    url: location.href,
    imglist: Object.fromEntries(imglistEntry),
  };
  // _port.postMessage(message);
  browser.runtime.sendMessage(message).then((res) =>{
    console.log(res);
  });
};


/* DOM SELECTOR */
const markElement = document.createElement('div');
markElement.style.backgroundColor = 'rgba(175,223,228,0.5)';
markElement.style.border = 'dashed 2px #0000FF';
markElement.style.display = 'none';
markElement.style.zIndex = '8000';

document.body.appendChild(markElement);

const selectElement = (selector: string) =>{
  const target = document.querySelector(selector);
  if (!target) {
    // HIDE
    markElement.style.display = 'none';
    return;
  }
  const {left, top} = target.getBoundingClientRect();
  if (target === null) return;
  markElement.style.top = `${window.pageYOffset + top}px`;
  markElement.style.left = `${window.pageXOffset + left}px`;
  markElement.style.width = `${target.clientWidth}px`;
  markElement.style.height = `${target.clientHeight}px`;
  markElement.style.display = 'block';
  markElement.style.position = 'absolute';
  // TODO position-fixじゃなければ画像の中心が画面の真ん中に来るように
  scrollTo(0,
      window.pageYOffset + top + target.clientHeight/2 - window.innerHeight/2);
};

/* EVENT LISTENER & TRIGGER */
window.addEventListener('load', function() {
  sendImgList();
});

browser.runtime.onMessage.addListener((message: Message.Message) => {
  switch (message.command) {
    case 'requestImgList':
      sendImgList();
      break;
    case 'selectDOMElement':
      selectElement(message.selector);
      break;
  }
});

setInterval(()=>{
  sendImgList();
}, 3000);
