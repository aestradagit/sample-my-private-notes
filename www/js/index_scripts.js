/*global Image: false, document: false, intel: false, localStorage: false, $: false, console: false */

(function () {
    "use strict";
	
    /*******************************************************************************************/
    //this function reads the "storageIdList" and loads all the existing secureStorage objects,
    //it updates the "itemList" with the read information and updates the application listview.
    /*******************************************************************************************/
    function loadItemsFromStorage() {
        var storageIdList = JSON.parse(localStorage.getItem('storageIdList'));
        //go over each item existing in secureStorage and load it.
        $.each
            (storageIdList, function (itemID, item) {
                //here we read the secureStorage object corresponding to the given itemID.               
                intel.security.secureStorage.read(function (instanceID) {
                    //Success callback, the secureStorage object was read successfully.
                    //a secureData object was created, now we get it's tag string.
                    intel.security.secureData.getTag(function (itemTags) {
                        //Success callback the Tag string was extracted successfully,
						//update internal structures and the listview
						var newItem = { 'instanceID': instanceID, 'item_tags': itemTags, 'item_text': null, 'isImage': item.isImage };
                        addItemToItemsList(itemID, newItem);
						addItemToListView(itemID, newItem);
                    }, fail, instanceID);
                }, fail, { 'id': itemID });
            });
    }
	
    /****************************************************************************************/
    //create a new secure Item from the input data using Intel Security Services API.
    //itemID - time id which is used for internal data structures.
    //itemTags - tag string passed to the Intel Security Services API.
    //itemData - the data we want to secure, either a plain-text or image url.
    /****************************************************************************************/
    function createNewSecureItem(itemID, itemTags, itemData) {
        //secure the data by creating a secureData object, the data and tag string are passed
        //as parameters
        intel.security.secureData.createFromData(function (instanceID) {
            //this is the success callback, a secureData object was created,
            //next we want to secure the object in secure storage.
            intel.security.secureStorage.writeSecureData(function () {
                //this is the success callback, secureData object was stored in secure storage,
                //update the internal data structures and update the listview.
                isValidImageUrl(itemData, function () {
                    //item is an image                                                          
                    addItemToStorageIdList(itemID, true);
					var newItem = { 'instanceID': instanceID, 'item_tags': itemTags, 'item_text': itemData, 'isImage': true };
                    addItemToItemsList(itemID, newItem);
					addItemToListView(itemID, newItem);
                }, function () {
                    //item is plain-text
                    addItemToStorageIdList(itemID, false);
					var newItem = { 'instanceID': instanceID, 'item_tags': itemTags, 'item_text': itemData, 'isImage': false };
                    addItemToItemsList(itemID, newItem);
					addItemToListView(itemID, newItem);
                });
            }, fail, { 'id': itemID, 'instanceID': instanceID });
        }, fail, { 'data': itemData, 'tag': itemTags });
    }

    /***********************************************************************************************/
    //"storageIdList" is an array which holds the collection of id's for all the existing secureStorage
    //objects, its used in the onDeviceReady event to read the secureStorage objects and create the 
    //"itemList".
    //its stored in localStorage.
    //itemID - the item id used as the key in storageIdList list and as the id for the secureStorage
    //object.
    //isImage - flag indication if the item is an image.
    /**********************************************************************************************/
    function addItemToStorageIdList(itemID, isImage) {
        var items = JSON.parse(localStorage.getItem('storageIdList'));
        var newItem = { 'isImage': isImage };
        items[itemID] = newItem;
        localStorage.setItem('storageIdList', JSON.stringify(items));
    }

    /**********************************************************************************************/
    //"itemList" is an array which contains information on the items currently in the application,
    //its stored in localStorage.
    //instanceID - secureData instanceID, if item is not secured then this will be null.
    //itemID - id for the item, used as the key in the "itemList" array.
    //item - the item we add
    /**********************************************************************************************/
    function addItemToItemsList(itemID, item) {
        var items = JSON.parse(localStorage.getItem('itemsList'));
        items[itemID] = item;
        localStorage.setItem('itemsList', JSON.stringify(items));
    }
	
	/**********************************************************************************************/
    //this function adds an item to the application listview
    /**********************************************************************************************/	
    function addItemToListView(itemID, item) {
        var listElem = $('<li><a id="' + itemID +
                        '" href="#item_page_popup" data-position-to="window" data-rel="popup"' +
                         ' data-theme="b" class="list_elem ui-btn ui-btn-b" data-transition="slide" ' +
                         'data-position-to="window" data-direction="reverse"><h3> ' +
                                itemID + '</h3><p><strong>Categories: ' + item.item_tags + '</stong></p></a></li>').hide();
        if (isItemSecured(item)) {
            listElem.find('a').addClass('ui-icon-lock ui-btn-icon-right');
        }
        listElem.click(function () {
            $('#item_text').hide();
            $('#item_image').show();
            //set id and tags for the selected item
            $('#item_id').text(itemID);
            $('#item_tag').val(item.item_tags);
            if (!(isItemSecured(item))) {
                if (item.isImage === true) {
                    $('#item_image').attr('src', item.item_text);
                }
                else {
                    //this is a text item so show the text element and hide the image element
                    $('#item_text').show();
                    $('#item_image').hide();
                    $('#item_text').val(item.item_text);
                }
                $('#show_item_button').text("Secure");
                $('#show_item_button').buttonMarkup({ icon: "lock" });
            }
            else {
                $('#item_image').attr('src', 'images/lock-it.png');
				$('#show_item_button').text('Show');
                $('#show_item_button').buttonMarkup({ icon: "eye" });
            }
        });
        var list = $('#items_list');
        list.append(listElem).listview('refresh');
        listElem.slideDown(350); //slide effect, delay of 350 ms.
    }
	
	/**********************************************************************************************/
    //remove item from listView
    /**********************************************************************************************/
	function removeItemFromListView(itemID){
		$("#" + itemID).parent().remove(); 
		$('#items_list').listview('refresh');
	}
	/**********************************************************************************************/
    //single point of failure for all API calls in this sample, for more information on
    //the error object, consult with Intel Security Services API documentation.
    /**********************************************************************************************/
    function fail(errObj) {
		console.error('Error Code: ' + errObj.code + ' Error message: ' + errObj.message);
    }
	
    /**********************************************************************************************/
    //event handlers
    /**********************************************************************************************/
    function register_event_handlers() {
        $(document).on("click", "#save_item", function (evt) {
			if ($('#new_item_id').val() === ""){
				$('#new_item_id').attr("placeholder", "Item Id field is required");
				return;
			}
			if ($('#new_item_text').val() === ""){
				$('#new_item_text').attr("placeholder", "Item data is required");
				return;
			}            
			//itemID is used as the html element id, so it cant contain spaces.
			var itemID = $('#new_item_id').val().replace(" ", "_");
			//if an item with the id exists then dont add the new item.
			var items = JSON.parse(localStorage.getItem('itemsList'));
			if (itemID in items){
				$('#new_item_id').val("");
				$('#new_item_id').attr("placeholder", "Item ID exists");
				return;
			}
			$('#new_item_popup').popup("close");
			var itemTag = $('#new_item_tags').val();
            if ($('#secure_item').val() === 'on') {
                createNewSecureItem(itemID, itemTag, $('#new_item_text').val());
                clearNewItemPage();
            }
            else {
				//item is not secured
				if ($('#new_item_text').val() === "")
				{
					//no item data was provided so an item will not be created.
					return;
				}
                isValidImageUrl($('#new_item_text').val(), function () {
					var newItem = { 'instanceID': null, 'item_tags': itemTag,
									'item_text': $('#new_item_text').val(), 'isImage': true};
                    addItemToItemsList(itemID, newItem);
					addItemToListView(itemID, newItem);
                    clearNewItemPage();
                },
				function () {
					var newItem = { 'instanceID': null, 'item_tags': itemTag,
									'item_text': $('#new_item_text').val(), 'isImage': false};
                    addItemToItemsList(itemID, newItem);
					addItemToListView(itemID, newItem);
                    clearNewItemPage();
                });
            }
        });

        /***************************************************************************************/
        //callback code for the show item button
        /***************************************************************************************/
        $(document).on("click", "#show_item_button", function (evt) {
            var itemID = $('#item_id').text();
            var items = JSON.parse(localStorage.getItem('itemsList'));
            var item = items[itemID];
            if (!(isItemSecured(item))) {
                delete items[itemID];
                localStorage.setItem('itemsList', JSON.stringify(items));
                createNewSecureItem(itemID, item.item_tags, item.item_text, item.isImage);
                $('#item_page_popup').popup("close");
                removeItemFromListView(itemID);
            }
            else if ($('#show_item_button').text() === 'Show') {
                //extract the data from the secure data object using the corresponding instanceID           
                intel.security.secureData.getData(function (itemData) {
                    //successfully extracted the data, we can now show it to the user
					$('#show_item_button').text('Show');
                    if (item.isImage === true) {
                        $('#item_image').attr('src', itemData);
                    }
                    else {
                        //item is a text item
                        $('#item_text').show();
                        $('#item_image').hide();
                        $('#item_text').val(itemData);
                        $('#item_text').textinput('refresh');
                    }
                    //set button to close                                                            
                    $('#show_item_button').buttonMarkup({ icon: 'back'});
                    $('#show_item_button').text('Close');
                },
                fail,
				item.instanceID);
            }
            else {
                //button is close
                $('#show_item_button').text('Show');
                $('#item_page_popup').popup('close');
            }
        });
    }
    /**************************************************************************/
    //clear the new item form from user data
    /**************************************************************************/
    function clearNewItemPage() {
        $('#new_item_text').val('');
        $('#item_text').textinput('refresh');
        $('#new_item_id').val('');
        $('#new_item_tags').val('');
        $('#secure_item').val('on').slider("refresh");
    }    

    $(function () {
        document.addEventListener("deviceready", onDeviceReady, false);
    });

    /**************************************************************************/

    function onDeviceReady() {
        //empty the listview
        var list = $('#items_list');
        list.empty();
        //clear the itemList from all secured items, those items will 
        //be reloaded from secureStorage. Add to the listView the unsecure items.
		//the reason for this is that secure items are read from secure storage and new 
		//secureData objects are created
        var itemsList;
        if ('itemsList' in localStorage) {
            itemsList = JSON.parse(localStorage.getItem('itemsList'));
            $.each
               (itemsList, function (itemID, item) {
                   if (isItemSecured(item)) {
                       delete itemsList[itemID];
                   }
                   else {
                       addItemToListView(itemID, item);
                   }
               });
            localStorage.setItem('itemsList', JSON.stringify(itemsList));
        }
        else {
            //there is no itemsList, create a new one.
            itemsList = {};
            localStorage.setItem('itemsList', JSON.stringify(itemsList));
        }

        //if this is the first time the app loads then load default items.
        //and create the storageIdList
        if (!('storageIdList' in localStorage)) {
            var storageIdList = {};
            localStorage.setItem('storageIdList', JSON.stringify(storageIdList));
            loadDefaultItems();
        }
        else {
            //load all item stored in secure storage and update the listView
            //with the loaded items.
            loadItemsFromStorage();
        }

        //add event callbacks
        $("#item_page_popup").bind({
            popupafterclose: function (event, ui) {
                $('#show_item_button').show();
                $('#show_item_button').text('Show');
                $('#item_text').val('');
                $('#item_image').attr('src', 'images/lock-it.png');
            }
        });		
		
        //swipe delete event callback
        $(document).on("swipeleft swiperight", ".list_elem", function (event) {
            var itemID = $(this).attr('id');
            $("#confirm").popup("open");
            $("#confirm #yes").on("click", function () {
				removeItemFromListView(itemID);
                var itemsList = JSON.parse(localStorage.getItem("itemsList"));
                var storageIdList = JSON.parse(localStorage.getItem("storageIdList"));
                //if item is in secure storage remove secureStorage object.
                if (itemID in storageIdList) {
                    var storageID = itemID;
                    //the secureStorage item is deleted, the id of the item we want removed is the parameter.
                    //we provide no Success callback, null is passed.
					
                    intel.security.secureStorage.delete(null, fail, { 'id': storageID });
                    delete storageIdList[itemID];
                    localStorage.setItem('storageIdList', JSON.stringify(storageIdList));
                }
                //check if itemList holds the item (should be always true) and check that item is secured.
                if (itemID in itemsList){ 
					if (isItemSecured(itemsList[itemID])){
						var instanceID = itemsList[itemID].instanceID;
						//the secureData item is destroyed, the instanceID for the item we want removed is the parameter.
						//we provide no Success callback, null is passed.
						intel.security.secureData.destroy(null, fail, instanceID);
					}
					delete itemsList[itemID];
					localStorage.setItem('itemsList', JSON.stringify(itemsList));
				}
                $("#confirm #yes").off();				
            });
            $("#confirm #cancel").on("click", function () {
                $("#confirm #cancel").off();
            });
        });
    }
	
    /*********************************************************************************************/
    //function loads default items, so if the app loads for the first time it is not empty.
    /*********************************************************************************************/
    function loadDefaultItems() {
        createNewSecureItem('Social_media', 'password private', '12345678');
        createNewSecureItem('e-mail', 'password private', 'this-is-my-email-password');
        createNewSecureItem('Bank', 'password private', 'abcdef');
        convertImgToBase64('images/photo-01.jpg', function (base64Img) {
            createNewSecureItem('Camping', 'image public', base64Img);
        });
        convertImgToBase64('images/photo-02.jpg', function (base64Img) {
            createNewSecureItem('Kids_1', 'image private', base64Img);
        });
        convertImgToBase64('images/photo-03.jpg', function (base64Img) {
            createNewSecureItem('Kids_2', 'image private', base64Img);
        });
        //create one default unsecured item
        convertImgToBase64('images/photo-04.jpg', function (base64Img) {
			var itemID = 'My_tablet';
			var newItem = { 'instanceID': null, 'item_tags': 'image public',
									'item_text': base64Img, 'isImage': true};
			addItemToItemsList(itemID, newItem);
			addItemToListView(itemID, newItem);
        });
    }
	
    /*********************************************************************************************/
    //filter function implementation, if item is to be filtered out a true value will be returned. 
    /*********************************************************************************************/
    $.mobile.document.one("filterablecreate", "#items_list", function () {
        $("#items_list").filterable("option", "filterCallback", function (index, searchValue) {
            if (searchValue === "") {
                return false;
            }
            var searchTags = searchValue.toLowerCase().split(" ");
            var elementTags = $(this).find('p').contents().text().toLowerCase().split(" ");
			var searchTagsFound  = searchTags.every(function(val) { return elementTags.indexOf(val) >= 0; });
			if (searchTagsFound === true)
			{
				return false; //show item
			}
			return true; //filter item out
        });
    });
	
	//test if url is a vaild image
    function isValidImageUrl(url, success, failure) { 
        $("<img>", {
            src: url,
            error: failure,
            load: success
        });
    }
	
    function convertImgToBase64(url, callback) {
        var canvas = document.createElement('CANVAS');
        var ctx = canvas.getContext('2d');
        var img = new Image();
        img.onload = function () {
            canvas.height = img.height;
            canvas.width = img.width;
            ctx.drawImage(img, 0, 0);
            var dataURL = canvas.toDataURL('image/png');
            callback.call(this, dataURL);
            canvas = null;
        };
        img.src = url;
    }
	
    function isItemSecured(item) {
        //if item has an instanceID associated with a secureData object then item is secured
        if (item.instanceID !== null) {
            return true;
        }
        return false;
    }
	
    $(document).ready(register_event_handlers);
})();